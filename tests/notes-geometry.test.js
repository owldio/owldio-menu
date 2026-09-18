import { describe, expect, it } from "vitest";

import { PAGE_HEIGHT_BOUNDS, resolvePageHeight } from "../src/domain/notes-geometry.js";

describe("resolvePageHeight", () => {
  it("gives a phone a tall page so the leaf fills the screen", () => {
    const height = resolvePageHeight({ stageWidth: 359, stageHeight: 700, twoUp: false });

    expect(height).toBe(Math.round((800 * 700) / 359));
    expect(height).toBeGreaterThan(1400);
  });

  it("gives a wide desktop spread a shallower page", () => {
    const single = resolvePageHeight({ stageWidth: 360, stageHeight: 700, twoUp: false });
    const spread = resolvePageHeight({ stageWidth: 1256, stageHeight: 700, twoUp: true });

    expect(spread).toBeLessThan(single);
  });

  it("matches the stage proportions so nothing is letterboxed", () => {
    const stageWidth = 600;
    const stageHeight = 900;
    const height = resolvePageHeight({ stageWidth, stageHeight, twoUp: false });

    expect(800 / height).toBeCloseTo(stageWidth / stageHeight, 2);
  });

  it("keeps the page within readable bounds on extreme stages", () => {
    const squat = resolvePageHeight({ stageWidth: 4000, stageHeight: 300, twoUp: true });
    const towering = resolvePageHeight({ stageWidth: 200, stageHeight: 3000, twoUp: false });

    expect(squat).toBe(PAGE_HEIGHT_BOUNDS.minimum);
    expect(towering).toBe(PAGE_HEIGHT_BOUNDS.maximum);
  });

  it("falls back to the middle of the range when the stage has no size yet", () => {
    const height = resolvePageHeight({ stageWidth: 0, stageHeight: 0, twoUp: false });

    expect(height).toBeGreaterThanOrEqual(PAGE_HEIGHT_BOUNDS.minimum);
    expect(height).toBeLessThanOrEqual(PAGE_HEIGHT_BOUNDS.maximum);
  });
});
