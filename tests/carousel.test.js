import { describe, expect, it } from "vitest";

import {
  advanceCarouselIndex,
  frontmostOrbitIndex,
  relativeCarouselOffset,
  resolveMarqueeOffset,
  resolveOrbitTransition,
  resolveOrbitPose,
} from "../src/domain/carousel.js";

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

describe("programme marquee motion", () => {
  it("advances slowly while idle and wraps into the same continuous cycle", () => {
    expect(
      resolveMarqueeOffset({
        offset: -990,
        elapsedMs: 1_000,
        pixelsPerSecond: 20,
        cycleWidth: 1_000,
        interaction: "idle",
      }),
    ).toBe(-10);
  });

  it("follows the pointer from the exact place where a drag started", () => {
    expect(
      resolveMarqueeOffset({
        offset: -400,
        elapsedMs: 16,
        pixelsPerSecond: 20,
        cycleWidth: 1_000,
        interaction: "dragging",
        dragStartOffset: -400,
        dragStartX: 300,
        pointerX: 460,
      }),
    ).toBe(-240);
  });

  it("holds its exact position while a pointer is over the marquee", () => {
    expect(
      resolveMarqueeOffset({
        offset: -412.5,
        elapsedMs: 2_000,
        pixelsPerSecond: 20,
        cycleWidth: 1_000,
        interaction: "hovered",
      }),
    ).toBe(-412.5);
  });
});

describe("programme carousel orbit", () => {
  it("places the leading programme at the front centre of the carousel", () => {
    expect(
      resolveOrbitPose({
        itemIndex: 0,
        itemCount: 5,
        orbitProgress: 0,
        radiusX: 420,
        radiusY: 52,
        radiusZ: 140,
      }),
    ).toEqual({
      x: 0,
      y: 52,
      z: 140,
      rotationY: 0,
      scale: 1,
      opacity: 1,
      brightness: 1,
      depth: 1,
      zIndex: 1010,
    });
  });

  it("hands selection to the next programme when it reaches the front", () => {
    expect(frontmostOrbitIndex({ itemCount: 5, orbitProgress: -0.2 })).toBe(1);
  });

  it("keeps an arrow turn between editions until the turn duration completes", () => {
    expect(
      resolveOrbitTransition({
        fromOffset: -200,
        toOffset: -400,
        elapsedMs: 500,
        durationMs: 1_000,
      }),
    ).toEqual({ offset: -300, progress: 0.5, complete: false });
  });
});
