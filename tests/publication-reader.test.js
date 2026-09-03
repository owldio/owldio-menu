import { describe, expect, it } from "vitest";

import {
  choosePageMode,
  movePublicationPage,
  publicationSpread,
  triFoldReadingOrder,
} from "../src/domain/publication-reader.js";
import * as publicationReader from "../src/domain/publication-reader.js";

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

  it("uses the physical fold viewer for a tri-fold sheet on a wide screen", () => {
    expect(choosePageMode({
      viewportWidth: 1440,
      pageWidth: 1185,
      pageHeight: 842,
      foldMode: "tri-fold",
    })).toBe("fold");
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

  it("uses the reading sequence configured for an individual publication", () => {
    const moonlightPromiseOrder = [
      { pageNumber: 1, panelIndex: 0 },
      { pageNumber: 2, panelIndex: 2 },
      { pageNumber: 1, panelIndex: 2 },
      { pageNumber: 2, panelIndex: 1 },
      { pageNumber: 2, panelIndex: 0 },
      { pageNumber: 1, panelIndex: 1 },
    ];

    expect(triFoldReadingOrder(2, moonlightPromiseOrder)).toEqual(moonlightPromiseOrder);
  });
});

describe("triFoldDesktopSteps", () => {
  it("follows the physical four-stage unfolding sequence from the reference video", () => {
    expect(publicationReader.triFoldDesktopSteps(2)).toEqual([
      { id: "closed", label: "封面" },
      { id: "first-open", label: "打開第一折" },
      { id: "inside-open", label: "完整展開" },
      { id: "outside-open", label: "翻至背面" },
    ]);
  });

  it("returns through the two-panel view before closing onto a configured back cover", () => {
    expect(publicationReader.triFoldDesktopSteps(2, { backCoverPanelIndex: 1 })).toEqual([
      { id: "closed", label: "封面" },
      { id: "first-open", label: "打開第一折" },
      { id: "inside-open", label: "完整展開" },
      { id: "refold", label: "折回右頁" },
      { id: "back-cover", label: "封底" },
    ]);
  });
});

describe("resolveTriFoldInsideOrder", () => {
  it("maps the imposed PDF panels into their physical left-to-right order", () => {
    expect(publicationReader.resolveTriFoldInsideOrder([2, 1, 0])).toEqual([2, 1, 0]);
  });

  it("falls back when the configured order is not a complete panel permutation", () => {
    expect(publicationReader.resolveTriFoldInsideOrder([2, 2, 0])).toEqual([0, 1, 2]);
  });
});

describe("resolveTriFoldCoverPanel", () => {
  it("mirrors the physical fold when the cover is printed on the right panel", () => {
    expect(publicationReader.resolveTriFoldCoverPanel(2)).toBe(2);
  });

  it("falls back to the left panel for unsupported cover positions", () => {
    expect(publicationReader.resolveTriFoldCoverPanel(1)).toBe(0);
  });
});

describe("resolveTriFoldPanelCrop", () => {
  it("uses the calibrated fold lines instead of leaking the neighbouring panel", () => {
    const crop = publicationReader.resolveTriFoldPanelCrop({
      pageNumber: 1,
      panelIndex: 2,
      pageWidth: 1811,
      panelBoundaries: {
        1: [0, 611 / 1811, 1226 / 1811, 1],
      },
    });

    expect(crop.left).toBeCloseTo(1226, 6);
    expect(crop.width).toBeCloseTo(585, 6);
  });
});

describe("classifyPublicationGesture", () => {
  it("turns an unzoomed horizontal swipe into the next page action", () => {
    expect(publicationReader.classifyPublicationGesture({
      deltaX: -72,
      deltaY: 8,
      zoom: 1,
    })).toBe("next");
  });

  it("pans the enlarged page instead of changing pages", () => {
    expect(publicationReader.classifyPublicationGesture({
      deltaX: -120,
      deltaY: 12,
      zoom: 1.01,
    })).toBe("pan");
  });

  it("treats a steady release as a tap instead of an accidental page turn", () => {
    expect(publicationReader.classifyPublicationGesture({
      deltaX: 6,
      deltaY: -4,
      zoom: 1,
    })).toBe("tap");
  });
});

describe("isPublicationDoubleTap", () => {
  it("recognises two nearby taps within the mobile double-tap window", () => {
    expect(publicationReader.isPublicationDoubleTap(
      { x: 180, y: 420, at: 1000 },
      { x: 193, y: 408, at: 1260 },
    )).toBe(true);
  });

  it("keeps distant taps as separate chrome toggles", () => {
    expect(publicationReader.isPublicationDoubleTap(
      { x: 80, y: 420, at: 1000 },
      { x: 320, y: 420, at: 1200 },
    )).toBe(false);
  });
});

describe("classifyPublicationTapZone", () => {
  it("turns steady taps on the left and right edges into page actions", () => {
    expect(publicationReader.classifyPublicationTapZone({
      clientX: 72,
      stageLeft: 20,
      stageWidth: 360,
      zoom: 1,
    })).toBe("previous");
    expect(publicationReader.classifyPublicationTapZone({
      clientX: 328,
      stageLeft: 20,
      stageWidth: 360,
      zoom: 1,
    })).toBe("next");
  });

  it("keeps the centre as the controls toggle and disables edge paging while zoomed", () => {
    expect(publicationReader.classifyPublicationTapZone({
      clientX: 200,
      stageLeft: 20,
      stageWidth: 360,
      zoom: 1,
    })).toBe("toggle-chrome");
    expect(publicationReader.classifyPublicationTapZone({
      clientX: 328,
      stageLeft: 20,
      stageWidth: 360,
      zoom: 1.01,
    })).toBe("toggle-chrome");
  });
});

describe("resolvePublicationPinchZoom", () => {
  it("scales in proportion to the distance between two fingers", () => {
    expect(publicationReader.resolvePublicationPinchZoom({
      startZoom: 1,
      startDistance: 100,
      currentDistance: 180,
    })).toBeCloseTo(1.8, 6);
  });

  it("clamps pinch zoom to the reader minimum and maximum", () => {
    expect(publicationReader.resolvePublicationPinchZoom({
      startZoom: 1.4,
      startDistance: 100,
      currentDistance: 30,
    })).toBe(1);
    expect(publicationReader.resolvePublicationPinchZoom({
      startZoom: 1.8,
      startDistance: 100,
      currentDistance: 180,
    })).toBe(2.2);
  });
});

describe("normalizePublicationZoom", () => {
  it("keeps a continuous pinch result instead of snapping to ten-percent steps", () => {
    expect(publicationReader.normalizePublicationZoom(1.37)).toBe(1.37);
    expect(publicationReader.normalizePublicationZoom(1.764)).toBe(1.76);
  });
});

describe("resolvePublicationDoubleTapZoom", () => {
  it("returns every enlarged state to one hundred percent", () => {
    expect(publicationReader.resolvePublicationDoubleTapZoom(1.01)).toBe(1);
    expect(publicationReader.resolvePublicationDoubleTapZoom(1.76)).toBe(1);
  });

  it("enlarges only when the reader is at one hundred percent", () => {
    expect(publicationReader.resolvePublicationDoubleTapZoom(1)).toBe(2.2);
  });
});

describe("fitTriFoldScale", () => {
  it("keeps the complete sheet inside the reader at the desktop breakpoint", () => {
    const scale = publicationReader.fitTriFoldScale({
      stageWidth: 792,
      stageHeight: 794,
      pageWidth: 1190,
      pageHeight: 842,
      horizontalPadding: 72,
      verticalPadding: 42,
    });

    expect(scale * 1190).toBeCloseTo(720, 6);
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
