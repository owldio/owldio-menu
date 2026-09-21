import { describe, expect, it } from "vitest";

import {
  followsLink,
  isDoubleTap,
  resistEdge,
  resolveSwipe,
  rubberBandZoom,
  settleZoom,
  swipeVelocity,
  tapZone,
} from "../src/domain/reader-gestures.js";

describe("tapZone", () => {
  it("turns back from the left third and forward from the right third", () => {
    expect(tapZone(20, 375)).toBe("previous");
    expect(tapZone(355, 375)).toBe("next");
  });

  it("opens the menu from the middle of the page", () => {
    expect(tapZone(187, 375)).toBe("menu");
    expect(tapZone(120, 375)).toBe("menu");
    expect(tapZone(255, 375)).toBe("menu");
  });

  it("treats an unmeasured stage as a menu tap rather than a turn", () => {
    expect(tapZone(10, 0)).toBe("menu");
  });
});

describe("isDoubleTap", () => {
  it("pairs two quick taps in the same place", () => {
    expect(isDoubleTap({ x: 100, y: 100, time: 0 }, { x: 110, y: 104, time: 220 })).toBe(true);
  });

  it("rejects taps that are too far apart in time or space", () => {
    expect(isDoubleTap({ x: 100, y: 100, time: 0 }, { x: 100, y: 100, time: 420 })).toBe(false);
    expect(isDoubleTap({ x: 100, y: 100, time: 0 }, { x: 190, y: 100, time: 120 })).toBe(false);
  });

  it("needs a first tap to pair with", () => {
    expect(isDoubleTap(null, { x: 0, y: 0, time: 0 })).toBe(false);
  });
});

describe("swipeVelocity", () => {
  it("reads the speed of the last stretch of the gesture", () => {
    const samples = [
      { x: 300, time: 0 },
      { x: 290, time: 200 },
      { x: 250, time: 260 },
      { x: 190, time: 300 },
    ];

    expect(swipeVelocity(samples)).toBeCloseTo(-1, 1);
  });

  it("is still when there is nothing to measure", () => {
    expect(swipeVelocity([])).toBe(0);
    expect(swipeVelocity([{ x: 10, time: 5 }])).toBe(0);
  });
});

describe("resolveSwipe", () => {
  const base = { width: 375, canPrevious: true, canNext: true };

  it("turns forward after a long drag to the left", () => {
    expect(resolveSwipe({ ...base, offset: -120, velocity: -0.1 })).toBe(1);
  });

  it("turns back after a long drag to the right", () => {
    expect(resolveSwipe({ ...base, offset: 120, velocity: 0.1 })).toBe(-1);
  });

  it("turns on a short, quick flick", () => {
    expect(resolveSwipe({ ...base, offset: -40, velocity: -0.8 })).toBe(1);
  });

  it("settles back on a short, slow drag", () => {
    expect(resolveSwipe({ ...base, offset: -40, velocity: -0.05 })).toBe(0);
  });

  it("does not turn past either end of the book", () => {
    expect(resolveSwipe({ ...base, canNext: false, offset: -200, velocity: -1 })).toBe(0);
    expect(resolveSwipe({ ...base, canPrevious: false, offset: 200, velocity: 1 })).toBe(0);
  });

  it("ignores a flick against the direction of the drag", () => {
    expect(resolveSwipe({ ...base, offset: -40, velocity: 0.9 })).toBe(0);
  });
});

describe("resistEdge", () => {
  it("follows the finger when there is a page to reveal", () => {
    expect(resistEdge(-80, { canPrevious: true, canNext: true })).toBe(-80);
  });

  it("drags heavily at the end of the book", () => {
    expect(resistEdge(-80, { canPrevious: true, canNext: false })).toBeCloseTo(-24);
    expect(resistEdge(80, { canPrevious: false, canNext: true })).toBeCloseTo(24);
  });
});

describe("rubberBandZoom", () => {
  const limits = { minimum: 1, maximum: 4 };

  it("passes zoom through inside the limits", () => {
    expect(rubberBandZoom(2.2, limits)).toBe(2.2);
  });

  it("gives a little below the fitted size, then stops", () => {
    const give = rubberBandZoom(0.8, limits);

    expect(give).toBeLessThan(1);
    expect(give).toBeGreaterThan(0.8);
    expect(rubberBandZoom(0.1, limits)).toBeGreaterThanOrEqual(0.6);
  });

  it("gives a little past the maximum, then stops", () => {
    const give = rubberBandZoom(4.6, limits);

    expect(give).toBeGreaterThan(4);
    expect(give).toBeLessThan(4.6);
    expect(rubberBandZoom(40, limits)).toBeLessThanOrEqual(5);
  });
});

describe("settleZoom", () => {
  const limits = { minimum: 1, maximum: 4 };

  it("springs back to the fitted size when released below it", () => {
    expect(settleZoom(0.72, limits)).toBe(1);
  });

  it("springs back to the maximum when released above it", () => {
    expect(settleZoom(4.4, limits)).toBe(4);
  });

  it("keeps a zoom the reader chose freely", () => {
    expect(settleZoom(2.37, limits)).toBe(2.37);
  });

  it("snaps a near-fitted zoom home so the page is not left a hair off", () => {
    expect(settleZoom(1.03, limits)).toBe(1);
  });
});

describe("followsLink", () => {
  it("follows a link tapped in the middle of the page", () => {
    expect(followsLink({ zone: "menu", interactive: true })).toBe(true);
  });

  it("follows an interactive control even when it sits in a page-turn zone", () => {
    expect(followsLink({ zone: "previous", interactive: true })).toBe(true);
    expect(followsLink({ zone: "next", interactive: true })).toBe(true);
  });

  it("follows nothing when the tap is on the page itself", () => {
    expect(followsLink({ zone: "menu", interactive: false })).toBe(false);
  });
});
