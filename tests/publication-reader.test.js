import { describe, expect, it } from "vitest";

import {
  choosePageMode,
  movePublicationPage,
  publicationSpread,
  triFoldReadingOrder,
} from "../src/domain/publication-reader.js";

describe("choosePageMode", () => {
  it("uses facing pages for a portrait publication on a wide screen", () => {
    expect(choosePageMode({ viewportWidth: 1280, pageWidth: 595, pageHeight: 842 })).toBe("spread");
  });

  it("keeps one page at a time on a phone", () => {
    expect(choosePageMode({ viewportWidth: 390, pageWidth: 595, pageHeight: 842 })).toBe("single");
  });

  it("keeps landscape artwork as one complete sheet", () => {
    expect(choosePageMode({ viewportWidth: 1280, pageWidth: 842, pageHeight: 595 })).toBe("single");
  });

  it("turns a tri-fold sheet into readable panels on a phone", () => {
    expect(choosePageMode({
      viewportWidth: 390,
      pageWidth: 842,
      pageHeight: 595,
      foldMode: "tri-fold",
    })).toBe("panel");
  });
});

describe("triFoldReadingOrder", () => {
  it("starts at the cover, opens the inside spread, then finishes the reverse side", () => {
    expect(triFoldReadingOrder(2)).toEqual([
      { pageNumber: 1, panelIndex: 2 },
      { pageNumber: 2, panelIndex: 0 },
      { pageNumber: 2, panelIndex: 1 },
      { pageNumber: 2, panelIndex: 2 },
      { pageNumber: 1, panelIndex: 0 },
      { pageNumber: 1, panelIndex: 1 },
    ]);
  });
});

describe("publicationSpread", () => {
  it("shows the cover alone, then pairs the inside pages", () => {
    expect(publicationSpread(1, 8, "spread")).toEqual([1]);
    expect(publicationSpread(2, 8, "spread")).toEqual([2, 3]);
    expect(publicationSpread(3, 8, "spread")).toEqual([2, 3]);
  });

  it("does not invent a partner for the last page", () => {
    expect(publicationSpread(8, 8, "spread")).toEqual([8]);
  });

  it("returns exactly one page in single-page mode", () => {
    expect(publicationSpread(4, 8, "single")).toEqual([4]);
  });
});

describe("movePublicationPage", () => {
  it("moves from the cover into two-page spreads and back", () => {
    expect(movePublicationPage(1, 1, 8, "spread")).toBe(2);
    expect(movePublicationPage(2, 1, 8, "spread")).toBe(4);
    expect(movePublicationPage(4, -1, 8, "spread")).toBe(2);
    expect(movePublicationPage(2, -1, 8, "spread")).toBe(1);
  });

  it("moves one page at a time in single-page mode and clamps the ends", () => {
    expect(movePublicationPage(3, 1, 4, "single")).toBe(4);
    expect(movePublicationPage(4, 1, 4, "single")).toBe(4);
    expect(movePublicationPage(1, -1, 4, "single")).toBe(1);
  });
});
