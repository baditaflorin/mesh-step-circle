# mesh-step-circle

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--step--circle-3FCB87?style=flat-square)](https://baditaflorin.github.io/mesh-step-circle/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-step-circle?style=flat-square&color=6a9082)](https://github.com/baditaflorin/mesh-step-circle/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-07120c?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Peer-to-peer browser mesh. Pocket your phone, walk together, watch the group's aggregate step counter climb. Free Fitbit-Premium social, minus the surveillance.

**Live:** https://baditaflorin.github.io/mesh-step-circle/

Each phone in a pocket detects its own steps via accelerometer and publishes the running total into a Yjs document over WebRTC. Every phone in the same room sees the aggregate "X,XXX steps together" and a per-walker leaderboard signed by name. Opt-in "stay together" mode nudges you with a gentle vibration when your cadence falls behind the group's mean.

## How it works

- DeviceMotion `accelerationIncludingGravity` is sampled at ~60 Hz on each phone.
- Gravity is removed by magnitude minus 9.81; a band-pass filter (1–3 Hz) isolates the walking gait; zero-up-crossings are counted as steps with a 300 ms debounce.
- A per-installation UUID (stored in `localStorage`) keys a `Y.Map<peerId, Walker>` shared via [y-webrtc](https://github.com/yjs/y-webrtc) and my self-hosted signaling.
- Cadence (steps per minute) is computed over a 10 s sliding window and re-published every 2 s.
- "Stay together" toggle: if room cadence stddev > 25 spm and you're 10 spm below the mean, your phone vibrates (strength configurable).

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). Short version: peers in your room see your name, step count, and cadence. The signaling server sees the room name and an SDP relay; it never sees steps. Raw accelerometer never leaves the device.

## Architecture

- **Mode A** — pure GitHub Pages. ([ADR 0001](docs/adr/0001-deployment-mode.md))
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN, overridable from Settings.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-step-circle.git
cd mesh-step-circle
npm install
npm run dev
```

Open the URL on two phones on the same Wi-Fi (or different networks — TURN relay handles cross-NAT). On iOS, motion permission is prompted on the "Allow motion & connect" tap.

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode](docs/adr/0001-deployment-mode.md)
- [0002 — Step detection: band-pass + zero-crossing](docs/adr/0002-step-detection.md)
- [0003 — Why signed-by-name here (vs anonymous in mesh-mood-check)](docs/adr/0003-signed-by-name.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
