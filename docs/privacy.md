# Privacy threat model — mesh-step-circle

## What other peers in the same room can see

For each walker:

- Your **display name** (you choose it; default is a randomly-picked bird name).
- Your **step count** (running total since you tapped "Allow motion & connect").
- The **timestamp** of your most recent detected step.
- Your **cadence** (steps per minute, computed over the last 10 seconds).

These are stored in a `Y.Map` keyed by a per-installation UUID that lives in `localStorage`. Wipe local storage to get a fresh identity.

## What stays local

- Your raw accelerometer samples. The DeviceMotion stream never leaves your phone; only counted steps and computed cadence are published.
- All settings (room ID, name, "stay together" toggle, vibration strength, signaling overrides).

## What the signaling server sees

`signaling-server` sees the **room name** (`mesh-step-circle:<roomId>`), the encrypted SDP relayed between peers, and your IP. It cannot read step counts or names because those flow peer-to-peer over WebRTC DataChannel.

## What the TURN server sees

`coturn-hetzner` relays encrypted DTLS-SRTP/DataChannel bytes when peers can't connect directly. It sees the two peer IPs and cannot decrypt the payload.

## Permissions asked

- **Motion / orientation** (`DeviceMotionEvent.requestPermission` on iOS) — required for step detection. Asked only on the user-gesture "Allow motion & connect" tap.
- **Vibration** (`navigator.vibrate`) — silent permission; the "stay together" feature uses it to nudge you when you fall behind.

## What's NOT in the threat model

- Anonymity within the room. The whole point is signed-by-name attribution. If you need anonymity, this is not the app for you.
- Network observers. Your Wi-Fi owner sees a WebSocket to `turn.0docker.com` and possibly a TURN relay flow. They can't decrypt the contents.
