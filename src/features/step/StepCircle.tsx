import { useEffect, useMemo, useRef, useState } from "react";
import { createRoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";

type Walker = {
  name: string;
  steps: number;
  lastStepAt: number;
  cadenceSpm: number;
};

type Props = {
  roomId: string;
  myPeerId: string;
  myName: string;
  stayTogether: boolean;
  vibrationStrength: number;
};

type DeviceMotionRequest = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const STEP_DEBOUNCE_MS = 300;
const MIN_PEAK_ACCEL = 1.2; // m/s^2 — gating above filtered noise floor

export function StepCircle({ roomId, myPeerId, myName, stayTogether, vibrationStrength }: Props) {
  const [armed, setArmed] = useState(false);
  const [walkers, setWalkers] = useState<Map<string, Walker>>(new Map());
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mesh = useMemo(() => {
    if (!armed) return null;
    return createRoomSync(roomId);
  }, [armed, roomId]);

  const myStepsRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const stepTimesRef = useRef<number[]>([]);
  // Band-pass filter state (two-stage HPF + LPF), sampling-rate-adaptive
  const filtStateRef = useRef({
    lastSample: 0,
    lastFilt: 0,
    smoothed: 0,
    prevSign: 0,
  });

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.provider?.destroy();
    };
  }, [mesh]);

  // DeviceMotion: detect steps via band-passed accel + zero-up-crossing
  useEffect(() => {
    if (!armed || !mesh) return undefined;
    let cancelled = false;
    let onMotion: ((e: DeviceMotionEvent) => void) | null = null;

    const start = async () => {
      const req = (window as unknown as { DeviceMotionEvent?: DeviceMotionRequest })
        .DeviceMotionEvent;
      if (req?.requestPermission) {
        try {
          const result = await req.requestPermission();
          if (result !== "granted") {
            setPermissionError("Motion permission denied — steps can't be counted.");
            return;
          }
        } catch (err) {
          setPermissionError(`Motion permission error: ${err}`);
          return;
        }
      }
      if (cancelled) return;

      const walkersMap = mesh.doc.getMap<Walker>("walkers");

      onMotion = (e: DeviceMotionEvent) => {
        const a = e.accelerationIncludingGravity ?? e.acceleration;
        if (!a) return;
        const ax = a.x ?? 0,
          ay = a.y ?? 0,
          az = a.z ?? 0;
        const mag = Math.sqrt(ax * ax + ay * ay + az * az);
        // Subtract gravity baseline (when using accelerationIncludingGravity).
        const raw = mag - 9.81;

        const s = filtStateRef.current;
        // Simple band-pass: HPF (subtract slow-moving mean) then LPF (smooth fast noise).
        // alphaHP ≈ 0.92 ≈ 1-3 Hz pass-band at ~60 Hz sample rate.
        const meanAlpha = 0.95;
        s.smoothed = meanAlpha * s.smoothed + (1 - meanAlpha) * raw;
        const hp = raw - s.smoothed;
        const lpAlpha = 0.4;
        const filt = lpAlpha * hp + (1 - lpAlpha) * s.lastFilt;
        const prevFilt = s.lastFilt;
        s.lastFilt = filt;

        // Zero-up-crossing with amplitude gate.
        const now = Date.now();
        const peakAround = Math.max(Math.abs(filt), Math.abs(prevFilt));
        if (
          prevFilt < 0 &&
          filt >= 0 &&
          peakAround > MIN_PEAK_ACCEL &&
          now - lastStepAtRef.current > STEP_DEBOUNCE_MS
        ) {
          lastStepAtRef.current = now;
          myStepsRef.current += 1;
          stepTimesRef.current.push(now);
          // keep last 10s of step timestamps for cadence
          const cutoff = now - 10_000;
          stepTimesRef.current = stepTimesRef.current.filter((t) => t > cutoff);

          const cadence = computeCadenceSpm(stepTimesRef.current);
          const next: Walker = {
            name: myName,
            steps: myStepsRef.current,
            lastStepAt: now,
            cadenceSpm: cadence,
          };
          mesh.doc.transact(() => walkersMap.set(myPeerId, next));
        }
      };
      window.addEventListener("devicemotion", onMotion);
    };

    void start();

    return () => {
      cancelled = true;
      if (onMotion) window.removeEventListener("devicemotion", onMotion);
    };
  }, [armed, mesh, myPeerId, myName]);

  // Subscribe to Yjs walkers map
  useEffect(() => {
    if (!mesh) return undefined;
    const map = mesh.doc.getMap<Walker>("walkers");
    const refresh = () => {
      const next = new Map<string, Walker>();
      map.forEach((v, k) => next.set(k, v));
      setWalkers(next);
    };
    map.observe(refresh);
    refresh();
    return () => map.unobserve(refresh);
  }, [mesh]);

  // Periodically re-publish my walker entry (in case name changed) and prune cadence
  useEffect(() => {
    if (!mesh) return undefined;
    const i = setInterval(() => {
      const map = mesh.doc.getMap<Walker>("walkers");
      const existing = map.get(myPeerId);
      const cadence = computeCadenceSpm(stepTimesRef.current);
      const next: Walker = {
        name: myName,
        steps: existing?.steps ?? myStepsRef.current,
        lastStepAt: existing?.lastStepAt ?? 0,
        cadenceSpm: cadence,
      };
      mesh.doc.transact(() => map.set(myPeerId, next));
    }, 2000);
    return () => clearInterval(i);
  }, [mesh, myPeerId, myName]);

  // "Stay together": if cadence stddev > 25 spm AND I'm below the mean, vibrate gently.
  useEffect(() => {
    if (!stayTogether || !mesh) return undefined;
    const interval = setInterval(() => {
      const cadences: number[] = [];
      walkers.forEach((w) => {
        if (w.cadenceSpm > 30) cadences.push(w.cadenceSpm);
      });
      if (cadences.length < 2) return;
      const mean = cadences.reduce((a, b) => a + b, 0) / cadences.length;
      const variance = cadences.reduce((acc, c) => acc + (c - mean) ** 2, 0) / cadences.length;
      const stddev = Math.sqrt(variance);
      const me = walkers.get(myPeerId);
      if (!me) return;
      if (stddev > 25 && me.cadenceSpm < mean - 10) {
        const ms = Math.round(80 + 120 * vibrationStrength);
        if ("vibrate" in navigator) navigator.vibrate?.(ms);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [stayTogether, mesh, walkers, myPeerId, vibrationStrength]);

  if (!armed) {
    return (
      <div className="step-arm">
        <h1>mesh-step-circle</h1>
        <p>
          Put your phone in a pocket. Each phone counts its own steps via accelerometer; the room
          sees the combined total and who's contributing. Walk together — when cadence drifts, the
          slow phones vibrate gently.
        </p>
        <p className="step-hint">
          You are <strong>{myName}</strong>. Change your name in Settings.
        </p>
        <button type="button" className="step-arm-button" onClick={() => setArmed(true)}>
          Allow motion &amp; connect
        </button>
        <p className="step-hint">
          Room <code>{roomId}</code>
        </p>
      </div>
    );
  }

  const sorted = [...walkers.entries()].sort(([, a], [, b]) => b.steps - a.steps);
  const total = sorted.reduce((acc, [, w]) => acc + w.steps, 0);

  return (
    <div className="step-stage">
      <div className="step-aggregate">
        <span className="step-aggregate-num">{total.toLocaleString()}</span>
        <span className="step-aggregate-label">steps together</span>
      </div>
      {permissionError && <p className="step-error">{permissionError}</p>}
      <ul className="step-walkers">
        {sorted.map(([id, w]) => (
          <li key={id} className={id === myPeerId ? "step-me" : ""}>
            <div className="step-walker-row">
              <span className="step-name">{w.name}</span>
              <span className="step-count">{w.steps.toLocaleString()}</span>
            </div>
            <small className="step-cadence">cadence: {Math.round(w.cadenceSpm)} spm</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function computeCadenceSpm(times: number[]): number {
  if (times.length < 2) return 0;
  const span = (times[times.length - 1]! - times[0]!) / 1000; // seconds
  if (span < 1) return 0;
  return (times.length - 1) * (60 / span);
}
