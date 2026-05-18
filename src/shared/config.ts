export const appConfig = {
  appName: "mesh-step-circle",
  storagePrefix: "mesh-step-circle",
  description:
    "Peer-to-peer mesh walking circle. Phones nudge with haptics when you fall behind the group's pace, no leader required.",
  accentHex: "#5fcf91",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-step-circle",
  pagesUrl: "https://baditaflorin.github.io/mesh-step-circle/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
