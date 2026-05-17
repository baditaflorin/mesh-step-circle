import { useEffect, useMemo, useRef, useState } from "react";
import { useStepCount, useVibration } from "@baditaflorin/mesh-common";
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

const STEP_DEBOUNCE_MS = 300;
const MIN_PEAK_ACCEL = 1.2; // m/s^2 — gating above filtered noise floor

export function StepCircle({ roomId, myPeerId, myName, stayTogether, vibrationStrength }: Props) {
  const [armed, setArmed] = useState(false);
  const [walkers, setWalkers] = useState<Map<string, Walker>>(new Map());
  const stepState = useStepCount({
    armed,
    threshold: MIN_PEAK_ACCEL,
    minStepMs: STEP_DEBOUNCE_MS,
  });
  const permissionError = stepState.error;
  const haptic = useVibration();

  const mesh = useMemo(() => {
    if (!armed) return null;
    return createRoomSync(roomId);
  }, [armed, roomId]);

  const lastStepAtRef = useRef(0);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.provider?.destroy();
    };
  }, [mesh]);

  // Publish on each detected step.
  useEffect(() => {
    if (!armed || !mesh) return;
    if (stepState.steps === 0) return;
    const now = Date.now();
    lastStepAtRef.current = now;
    const walkersMap = mesh.doc.getMap<Walker>("walkers");
    const next: Walker = {
      name: myName,
      steps: stepState.steps,
      lastStepAt: now,
      cadenceSpm: stepState.cadence,
    };
    mesh.doc.transact(() => walkersMap.set(myPeerId, next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, mesh, myPeerId, myName, stepState.steps]);

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
      const next: Walker = {
        name: myName,
        steps: existing?.steps ?? stepState.steps,
        lastStepAt: existing?.lastStepAt ?? lastStepAtRef.current,
        cadenceSpm: stepState.cadence,
      };
      mesh.doc.transact(() => map.set(myPeerId, next));
    }, 2000);
    return () => clearInterval(i);
  }, [mesh, myPeerId, myName, stepState.steps, stepState.cadence]);

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
        haptic.vibrate(ms);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [stayTogether, mesh, walkers, myPeerId, vibrationStrength, haptic]);

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
