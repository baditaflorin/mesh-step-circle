import { expect, test, type Page } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer test for the advertised core action:
 * "walk together, watch the group's aggregate step counter climb."
 *
 * The live pedometer cannot be driven from a real headless browser, BUT the
 * step detector (`useStepCount` → `useDeviceMotion`) listens for the standard
 * `devicemotion` event. We synthesise an accelerometer gait on peer A —
 * alternating high / low `accelerationIncludingGravity` samples that make the
 * smoothed magnitude cross the step threshold upward — and assert the AGGREGATE
 * "steps together" total rises on peer B. This exercises the real sensor path
 * end to end (no manual "+10" shim, no honest_down needed).
 */

/** Arm the step circle (start sensor + join the mesh room). */
async function arm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Allow motion & connect/i }).click();
  // Once armed the aggregate readout is on screen.
  await expect(page.locator(".step-aggregate-num")).toBeVisible();
}

/** Read the aggregate "steps together" number off a page. */
async function aggregate(page: Page): Promise<number> {
  const txt = (await page.locator(".step-aggregate-num").textContent()) ?? "0";
  return Number(txt.replace(/[^0-9]/g, "")) || 0;
}

/**
 * Synthesise `nSteps` walking steps on a page by dispatching DeviceMotion
 * events. The detector counts an UPWARD crossing of the smoothed magnitude
 * over its threshold, debounced ~300 ms. The smoothing factor (0.4) means a
 * single high sample is not enough — we push several high samples to lift the
 * smoothed magnitude over the bar, then several low samples to drop it back
 * under, with a real time gap between each step so the debounce clears.
 */
async function fakeSteps(page: Page, nSteps: number): Promise<void> {
  for (let i = 0; i < nSteps; i++) {
    // Each event is dispatched in its own async turn (with a small real delay)
    // so React re-renders the detector between samples instead of collapsing
    // a synchronous burst to its final value. Pattern: a few high samples to
    // lift the smoothed magnitude over the bar (peak of the gait), then a few
    // low samples to drop it back under (trough) — one upward crossing = one
    // counted step.
    const gait = [13, 13, 13, 13, 9.81, 9.81, 9.81];
    for (const z of gait) {
      await page.evaluate((zz) => {
        window.dispatchEvent(
          new DeviceMotionEvent("devicemotion", {
            acceleration: { x: 0, y: 0, z: zz - 9.81 },
            accelerationIncludingGravity: { x: 0, y: 0, z: zz },
            rotationRate: { alpha: 0, beta: 0, gamma: 0 },
            interval: 16,
          } as DeviceMotionEventInit),
        );
      }, z);
      await page.waitForTimeout(20);
    }
    // Real gap > the 300 ms step debounce before the next step.
    await page.waitForTimeout(320);
  }
}

test("synthetic walking on peer A raises the group's aggregate step total on peer B", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await arm(a);
    await arm(b);

    // Both peers start the round at 0 aggregate steps.
    expect(await aggregate(a)).toBe(0);
    expect(await aggregate(b)).toBe(0);

    // Peer A "walks" — drive the real accelerometer/step path.
    await fakeSteps(a, 6);

    // Peer A registered its own steps locally.
    await expect.poll(() => aggregate(a), { timeout: 8_000 }).toBeGreaterThanOrEqual(4);

    // CROSS-PEER ASSERTION: the AGGREGATE "steps together" total on peer B
    // rose to include peer A's walk — group step state genuinely crossed the
    // Yjs `walkers` map A → B.
    await expect.poll(() => aggregate(b), { timeout: 8_000 }).toBeGreaterThanOrEqual(4);

    // And peer A appears as a contributor in peer B's per-walker leaderboard.
    await expect(b.locator(".step-walkers li")).not.toHaveCount(0);
  } finally {
    await cleanup();
  }
});
