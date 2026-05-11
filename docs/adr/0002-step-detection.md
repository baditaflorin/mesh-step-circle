---
status: accepted
date: 2026-05-12
---

# 0002 — Step detection: band-pass + zero-crossing

## Context

We need a robust pedometer that runs entirely in the browser, with no native step-counting API. The signal available is `DeviceMotionEvent.accelerationIncludingGravity` (we prefer it over `acceleration` because iOS often nulls the gravity-removed channel). The signal is the 3-axis accelerometer at ~60 Hz (varies by device), pre-mixed with gravity at low frequency, walking gait at 1–3 Hz, and various clatter (limb-swing, vibration, hand tremor) at higher frequency.

## Decision

1. Compute scalar magnitude `‖a‖ − 9.81` per sample to subtract the gravity baseline.
2. Apply a single-pole high-pass via "running mean subtraction" (alpha = 0.95): `hp = raw − mean`. This rejects the slow gravity-drift residual and body sway.
3. Apply a single-pole low-pass on `hp` (alpha = 0.4): smooths high-frequency vibration.
4. Together the two filters form an approximate band-pass at 1–3 Hz at typical sample rates of 50–60 Hz.
5. Count **zero-up-crossings** of the band-passed signal as candidate steps, gated by a minimum local peak amplitude of 1.2 m/s² and a 300 ms debounce between consecutive steps.

## Consequences

- Robust to amplitude variation. A slow, light-footed walker produces small acceleration peaks; counting peak amplitude would under-count them. Zero-crossings detect the cycle regardless of magnitude.
- Robust to gravity orientation. We don't care which axis is "up"; the magnitude is rotation-invariant.
- 300 ms debounce caps cadence at ~200 spm — well above the realistic top of ~180 spm for fast walking and below the bottom of 240+ spm for running. The app is for walking; running cadence will under-count, which is fine.
- Cadence is computed over a 10-second sliding window of step timestamps, so the published spm reflects current pace, not the all-time average.
- Bouncing on the spot (e.g., laughing while standing) still triggers steps. We accept this; the social context defuses it.

## Alternatives considered

- **Peak-picking on raw magnitude.** Rejected — sensitive to amplitude; under-counts small-step walkers.
- **FFT-based cadence estimation.** Rejected — heavier compute, doesn't give per-step timestamps which are needed for the "stay together" feature.
- **Native pedometer via Web Permissions API.** Doesn't exist. The Generic Sensor API exposes the same raw accelerometer but iOS doesn't ship it.
