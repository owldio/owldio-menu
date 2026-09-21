import { describe, expect, it } from "vitest";

import { scrubberValueAtClientX } from "../src/domain/scrubber.js";

describe("scrubber pointer position", () => {
  const bounds = { left: 100, width: 400 };

  it("maps the full track directly to the available pages", () => {
    expect(scrubberValueAtClientX(100, bounds, 1, 41)).toBe(1);
    expect(scrubberValueAtClientX(300, bounds, 1, 41)).toBe(21);
    expect(scrubberValueAtClientX(500, bounds, 1, 41)).toBe(41);
  });

  it("clamps touches outside the track and handles an empty width", () => {
    expect(scrubberValueAtClientX(20, bounds, 1, 41)).toBe(1);
    expect(scrubberValueAtClientX(700, bounds, 1, 41)).toBe(41);
    expect(scrubberValueAtClientX(120, { left: 100, width: 0 }, 1, 41)).toBe(1);
  });
});
