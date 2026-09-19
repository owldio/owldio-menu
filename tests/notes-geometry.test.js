import { describe, expect, it } from "vitest";

import {
  CHROME_CLEARANCE,
  SPREAD_GAP,
  SPREAD_GUTTER,
  TEXT_SIZES,
  defaultTextSize,
  nextTextSize,
  pageOffset,
  resolveLayout,
  spreadWidth,
} from "../src/domain/notes-geometry.js";

describe("resolveLayout", () => {
  it("makes a phone page the size of the screen, with type at its true size", () => {
    const layout = resolveLayout({ stageWidth: 375, stageHeight: 812, twoUp: false, textSize: 17 });

    expect(layout).toMatchObject({ width: 375, height: 812, font: 17 });
    expect(layout.padX).toBeGreaterThanOrEqual(22);
    expect(layout.padX).toBeLessThan(30);
  });

  it("gives each page of a desktop spread half the screen", () => {
    const layout = resolveLayout({ stageWidth: 1440, stageHeight: 900, twoUp: true, textSize: 18 });

    expect(layout.width).toBe(Math.floor((1440 - SPREAD_GUTTER) / 2));
    expect(layout.height).toBe(900);
  });

  it("sets the text block to a whole number of characters, so Chinese lines meet both margins", () => {
    const cases = [
      { stageWidth: 390, textSize: 17, twoUp: false },
      { stageWidth: 375, textSize: 16, twoUp: false },
      { stageWidth: 1440, textSize: 18, twoUp: true },
      { stageWidth: 768, textSize: 20, twoUp: false },
    ];

    for (const { stageWidth, textSize, twoUp } of cases) {
      const layout = resolveLayout({ stageWidth, stageHeight: 800, twoUp, textSize });
      const characters = (layout.width - layout.padX * 2) / layout.font;

      expect(characters).toBe(Math.round(characters));
    }
  });

  it("keeps lines to a comfortable length on a wide page", () => {
    const layout = resolveLayout({ stageWidth: 768, stageHeight: 1024, twoUp: false, textSize: 18 });
    const charactersPerLine = (layout.width - layout.padX * 2) / layout.font;

    expect(charactersPerLine).toBeLessThanOrEqual(34.5);
    expect(charactersPerLine).toBeGreaterThan(30);
  });

  it("leaves room above and below the text for the running head and folio", () => {
    const layout = resolveLayout({ stageWidth: 375, stageHeight: 812, twoUp: false, textSize: 17 });

    expect(layout.padTop).toBeGreaterThan(layout.font * 2.5);
    expect(layout.padBottom).toBeGreaterThan(layout.font * 2.5);
  });

  it("keeps every size of text clear of the overlaid toolbar and progress rail", () => {
    for (const textSize of TEXT_SIZES) {
      const layout = resolveLayout({ stageWidth: 375, stageHeight: 812, twoUp: false, textSize });

      expect(layout.padTop).toBeGreaterThanOrEqual(CHROME_CLEARANCE);
      expect(layout.padBottom).toBeGreaterThanOrEqual(CHROME_CLEARANCE);
    }
  });

  it("gives larger text the room it needs instead of wider top and bottom margins", () => {
    const layout = resolveLayout({ stageWidth: 375, stageHeight: 812, twoUp: false, textSize: TEXT_SIZES.at(-1) });
    const textShare = (layout.height - layout.padTop - layout.padBottom) / layout.height;

    expect(textShare).toBeGreaterThan(0.8);
  });

  it("keeps a phone page in full dress at the default text size", () => {
    expect(resolveLayout({ stageWidth: 390, stageHeight: 664, twoUp: false, textSize: 17 }).compact).toBe(false);
    expect(resolveLayout({ stageWidth: 1440, stageHeight: 900, twoUp: true, textSize: 18 }).compact).toBe(false);
  });

  it("makes a page compact when it holds too few lines — a small phone, a phone on its side, or large text", () => {
    expect(resolveLayout({ stageWidth: 375, stageHeight: 548, twoUp: false, textSize: 17 }).compact).toBe(true);
    expect(resolveLayout({ stageWidth: 812, stageHeight: 375, twoUp: false, textSize: 18 }).compact).toBe(true);
    expect(resolveLayout({ stageWidth: 390, stageHeight: 664, twoUp: false, textSize: 24 }).compact).toBe(true);
  });

  it("widens the margins along with larger text", () => {
    const small = resolveLayout({ stageWidth: 375, stageHeight: 812, twoUp: false, textSize: 16 });
    const large = resolveLayout({ stageWidth: 375, stageHeight: 812, twoUp: false, textSize: 22 });

    expect(large.padX).toBeGreaterThan(small.padX);
  });

  it("still returns a usable page before the stage has a size", () => {
    const layout = resolveLayout({ stageWidth: 0, stageHeight: 0, twoUp: false, textSize: 17 });

    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("text size", () => {
  it("starts phones a step smaller than wide screens", () => {
    expect(defaultTextSize(375)).toBe(17);
    expect(defaultTextSize(1440)).toBe(18);
  });

  it("steps up and down through the size ladder", () => {
    expect(nextTextSize(17, 1)).toBe(18);
    expect(nextTextSize(18, -1)).toBe(17);
  });

  it("stops at either end of the ladder", () => {
    expect(nextTextSize(TEXT_SIZES.at(-1), 1)).toBe(TEXT_SIZES.at(-1));
    expect(nextTextSize(TEXT_SIZES[0], -1)).toBe(TEXT_SIZES[0]);
  });

  it("finds the nearest step from a size that is not on the ladder", () => {
    expect(nextTextSize(19, 1)).toBe(20);
    expect(nextTextSize(19, -1)).toBe(18);
  });
});

describe("spreadWidth", () => {
  it("is one page wide on a single-page reader", () => {
    expect(spreadWidth({ twoUp: false, pageWidth: 375 })).toBe(375);
  });

  it("is two pages and the gutter wide on a spread", () => {
    expect(spreadWidth({ twoUp: true, pageWidth: 719 })).toBe(719 * 2 + SPREAD_GUTTER);
  });
});

describe("pageOffset", () => {
  it("lays single pages out in a strip, one gap apart", () => {
    const stride = 375 + SPREAD_GAP;

    expect(pageOffset({ spreadDelta: 0, slot: 0, spreadLength: 1, twoUp: false, pageWidth: 375 })).toBe(0);
    expect(pageOffset({ spreadDelta: 1, slot: 0, spreadLength: 1, twoUp: false, pageWidth: 375 })).toBe(stride);
    expect(pageOffset({ spreadDelta: -1, slot: 0, spreadLength: 1, twoUp: false, pageWidth: 375 })).toBe(-stride);
  });

  it("sets facing pages side by side across the gutter", () => {
    expect(pageOffset({ spreadDelta: 0, slot: 1, spreadLength: 2, twoUp: true, pageWidth: 719 }))
      .toBe(719 + SPREAD_GUTTER);
  });

  it("centres a lone page, such as the cover, within its spread", () => {
    expect(pageOffset({ spreadDelta: 0, slot: 0, spreadLength: 1, twoUp: true, pageWidth: 719 }))
      .toBe((spreadWidth({ twoUp: true, pageWidth: 719 }) - 719) / 2);
  });

  it("moves whole spreads by one spread and one gap", () => {
    expect(pageOffset({ spreadDelta: 1, slot: 0, spreadLength: 2, twoUp: true, pageWidth: 719 }))
      .toBe(spreadWidth({ twoUp: true, pageWidth: 719 }) + SPREAD_GAP);
  });
});
