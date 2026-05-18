import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { StepCircle } from "./features/step/StepCircle";
import { SettingsExtras } from "./features/settings/SettingsExtras";
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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          myName={myName}
          onNameChange={setMyName}
          stayTogether={stayTogether}
          onStayTogetherChange={setStayTogether}
          vibration={vibration}
          onVibrationChange={setVibration}
        />
      }
    >
      <StepCircle
        roomId={roomId}
        myPeerId={myPeerId}
        myName={myName}
        stayTogether={stayTogether}
        vibrationStrength={vibration}
      />
    </MeshShell>
  );
}
