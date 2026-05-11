import { useEffect, useState } from "react";
import { StepCircle } from "./features/step/StepCircle";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  name: `${appConfig.storagePrefix}:name`,
  peerId: `${appConfig.storagePrefix}:peerId`,
  stayTogether: `${appConfig.storagePrefix}:stayTogether`,
  vibration: `${appConfig.storagePrefix}:vibration`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === "1";
}
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function ensurePeerId(): string {
  const existing = localStorage.getItem(STORAGE.peerId);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(STORAGE.peerId, next);
  return next;
}

function randomWalkerName(): string {
  const names = [
    "Tern",
    "Lark",
    "Heron",
    "Wren",
    "Finch",
    "Robin",
    "Sparrow",
    "Jay",
    "Otter",
    "Lynx",
  ];
  return names[Math.floor(Math.random() * names.length)] ?? "Walker";
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [myName, setMyName] = useState(() => readString(STORAGE.name, randomWalkerName()));
  const [stayTogether, setStayTogether] = useState(() => readBool(STORAGE.stayTogether, true));
  const [vibration, setVibration] = useState(() => readNumber(STORAGE.vibration, 0.5));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myPeerId] = useState(() => ensurePeerId());

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.name, myName);
  }, [myName]);
  useEffect(() => {
    localStorage.setItem(STORAGE.stayTogether, stayTogether ? "1" : "0");
  }, [stayTogether]);
  useEffect(() => {
    localStorage.setItem(STORAGE.vibration, String(vibration));
  }, [vibration]);

  return (
    <div className="app-root">
      <StepCircle
        roomId={roomId}
        myPeerId={myPeerId}
        myName={myName}
        stayTogether={stayTogether}
        vibrationStrength={vibration}
      />

      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        myName={myName}
        onNameChange={setMyName}
        stayTogether={stayTogether}
        onStayTogetherChange={setStayTogether}
        vibration={vibration}
        onVibrationChange={setVibration}
      />
    </div>
  );
}
