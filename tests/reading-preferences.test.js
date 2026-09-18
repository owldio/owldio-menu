import { describe, expect, it } from "vitest";

import {
  cycleReadingSize,
  normalizeReadingSize,
  resetReadingPosition,
} from "../src/domain/reading.js";

describe("native programme-note reading size", () => {
  it("cycles through standard, large, and extra-large text without a fixed zoom percentage", () => {
    expect(cycleReadingSize("standard")).toBe("large");
    expect(cycleReadingSize("large")).toBe("extra-large");
    expect(cycleReadingSize("extra-large")).toBe("standard");
  });

  it("falls back to standard text for an unknown saved preference", () => {
    expect(normalizeReadingSize("giant")).toBe("standard");
    expect(normalizeReadingSize(null)).toBe("standard");
  });

  it("returns a newly selected chapter to its heading after navigating from deep in an article", () => {
    const scrollingElement = { scrollTop: 1840 };
    const body = { scrollTop: 1840 };
    let blurred = false;
    let windowPosition = [0, 1840];

    resetReadingPosition({
      scrollingElement,
      body,
      activeElement: { blur: () => { blurred = true; } },
      scrollTo: (left, top) => { windowPosition = [left, top]; },
    });

    expect(scrollingElement.scrollTop).toBe(0);
    expect(body.scrollTop).toBe(0);
    expect(windowPosition).toEqual([0, 0]);
    expect(blurred).toBe(true);
  });
});
