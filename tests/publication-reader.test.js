import { describe, expect, it } from "vitest";

import {
  choosePageMode,
  movePublicationPage,
  publicationPreloadTargets,
  publicationSwipePositions,
  publicationSpread,
  resolvePublicationDragOffset,
  resolvePublicationSwipeRelease,
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

describe("resolveTriFoldOpeningLeaf", () => {
  it("opens the visible artist panel from the inner crease toward the right", () => {
    expect(publicationReader.resolveTriFoldOpeningLeaf({
      coverPanelIndex: 0,
      insidePanelOrder: [2, 1, 0],
      closingPanelIndex: 2,
      backCoverPanelIndex: 1,
    })).toEqual({
      positionPanelIndex: 1,
      hinge: "right",
      openRotation: 180,
      outsidePanelIndex: 2,
      insidePanelIndex: 0,
    });
  });

  it("keeps the standard tri-fold construction for other fold sequences", () => {
    expect(publicationReader.resolveTriFoldOpeningLeaf({
      coverPanelIndex: 2,
      insidePanelOrder: [0, 1, 2],
      closingPanelIndex: 0,
      backCoverPanelIndex: null,
    })).toBeNull();
  });
});

describe("resolveTriFoldActiveLeaf", () => {
  it("keeps the closing leaf active while returning from the back cover", () => {
    expect(publicationReader.resolveTriFoldActiveLeaf({
      foldStage: "refold",
      direction: "previous",
    })).toBe("closing");
  });

  it("uses the opening leaf for the ordinary inward refold", () => {
    expect(publicationReader.resolveTriFoldActiveLeaf({
      foldStage: "refold",
      direction: "next",
    })).toBe("opening");
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

describe("resolvePublicationDragOffset", () => {
  it("keeps an available horizontal page turn attached to the finger", () => {
    expect(resolvePublicationDragOffset({
      deltaX: -146,
      stageWidth: 390,
      canMovePrevious: false,
      canMoveNext: true,
    })).toBe(-146);
  });

  it("adds elastic resistance instead of dragging into an unavailable page", () => {
    expect(resolvePublicationDragOffset({
      deltaX: 100,
      stageWidth: 390,
      canMovePrevious: false,
      canMoveNext: true,
    })).toBe(18);
  });

  it("caps extreme movement so the artwork never escapes the stage", () => {
    expect(resolvePublicationDragOffset({
      deltaX: -900,
      stageWidth: 390,
      canMovePrevious: true,
      canMoveNext: true,
    })).toBe(-358.8);
  });
});

describe("publicationSwipePositions", () => {
  it("places the previous and next reading positions around the current panel", () => {
    expect(publicationSwipePositions(3, 6, "panel")).toEqual({
      previous: 2,
      current: 3,
      next: 4,
    });
  });

  it("leaves the unavailable side empty at the beginning and end", () => {
    expect(publicationSwipePositions(1, 6, "panel")).toEqual({
      previous: null,
      current: 1,
      next: 2,
    });
    expect(publicationSwipePositions(6, 6, "panel")).toEqual({
      previous: 5,
      current: 6,
      next: null,
    });
  });

  it("uses whole reading spreads instead of adjacent PDF page numbers", () => {
    expect(publicationSwipePositions(2, 8, "spread")).toEqual({
      previous: 1,
      current: 2,
      next: 4,
    });
  });
});

describe("resolvePublicationSwipeRelease", () => {
  it("continues a committed next-page drag to the next track slot", () => {
    expect(resolvePublicationSwipeRelease({
      offset: -220,
      velocityX: -0.2,
      stageWidth: 390,
      canMovePrevious: false,
      canMoveNext: true,
    })).toEqual({ action: "next", direction: 1, targetOffset: -390 });
  });

  it("returns a short slow drag to the current track slot", () => {
    expect(resolvePublicationSwipeRelease({
      offset: -35,
      velocityX: -0.1,
      stageWidth: 390,
      canMovePrevious: true,
      canMoveNext: true,
    })).toEqual({ action: "cancel", direction: 0, targetOffset: 0 });
  });

  it("commits a quick flick without requiring a long drag", () => {
    expect(resolvePublicationSwipeRelease({
      offset: -32,
      velocityX: -0.72,
      stageWidth: 390,
      canMovePrevious: true,
      canMoveNext: true,
    })).toEqual({ action: "next", direction: 1, targetOffset: -390 });
  });

  it("cannot commit into an unavailable edge slot", () => {
    expect(resolvePublicationSwipeRelease({
      offset: 180,
      velocityX: 0.8,
      stageWidth: 390,
      canMovePrevious: false,
      canMoveNext: true,
    })).toEqual({ action: "cancel", direction: 0, targetOffset: 0 });
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

describe("resolvePublicationFocusAnchor", () => {
  it("remembers the exact content point under the fingers before zooming", () => {
    expect(publicationReader.resolvePublicationFocusAnchor({
      point: { x: 110, y: 220 },
      rect: { left: 10, top: 20, width: 200, height: 400 },
    })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("resolvePublicationPinchTranslation", () => {
  it("moves the zoomed content with the centre point between both fingers", () => {
    expect(publicationReader.resolvePublicationPinchTranslation({
      startPoint: { x: 195, y: 420 },
      currentPoint: { x: 235, y: 450 },
    })).toEqual({ x: 40, y: 30 });
  });
});

describe("resolvePublicationFocusScroll", () => {
  it("keeps the remembered content point under the fingers after the preview ends", () => {
    expect(publicationReader.resolvePublicationFocusScroll({
      stageRect: { left: 10, top: 20 },
      canvasRect: { left: -40, top: -80, width: 400, height: 600 },
      scrollLeft: 60,
      scrollTop: 120,
      focusAnchor: { x: 0.5, y: 0.5 },
      focalPoint: { x: 160, y: 250 },
    })).toEqual({ left: 60, top: 90 });
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

describe("publicationPreloadTargets", () => {
  it("warms the next page first and then the previous page", () => {
    expect(publicationPreloadTargets(3, 6, "panel")).toEqual([4, 2]);
  });

  it("does not request the current page again at either end", () => {
    expect(publicationPreloadTargets(1, 6, "panel")).toEqual([2]);
    expect(publicationPreloadTargets(6, 6, "panel")).toEqual([5]);
  });

  it("preloads neighbouring spreads by their first page", () => {
    expect(publicationPreloadTargets(2, 8, "spread")).toEqual([4, 1]);
  });
});
