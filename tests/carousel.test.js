import { describe, expect, it } from "vitest";

import { advanceCarouselIndex, relativeCarouselOffset } from "../src/domain/carousel.js";

describe("programme carousel", () => {
  it("cycles through every programme in both directions", () => {
    expect(advanceCarouselIndex(0, 1, 5)).toBe(1);
    expect(advanceCarouselIndex(4, 1, 5)).toBe(0);
    expect(advanceCarouselIndex(0, -1, 5)).toBe(4);
  });

  it("places programmes on the shortest arc around the selected volume", () => {
    expect(relativeCarouselOffset(0, 0, 5)).toBe(0);
    expect(relativeCarouselOffset(1, 0, 5)).toBe(1);
    expect(relativeCarouselOffset(4, 0, 5)).toBe(-1);
    expect(relativeCarouselOffset(3, 0, 5)).toBe(-2);
    expect(relativeCarouselOffset(0, 4, 5)).toBe(1);
  });
});
