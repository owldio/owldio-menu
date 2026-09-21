import { describe, expect, it } from "vitest";

import {
  pageIndexForNote,
  pageHoldingAnchor,
  readingAnchorForPage,
  readingAnchorFromHistory,
} from "../src/domain/notes-position.js";

function fragment(start, end) {
  return {
    id: "note:p1",
    kind: "paragraph",
    payload: { text: "字".repeat(end - start), sourceStart: start, sourceEnd: end },
  };
}

describe("notes reading position", () => {
  it("resolves a contents link from the current pagination instead of a fixed page number", () => {
    const banner = { kind: "note-banner", noteSlug: "harp-solo" };
    const compactPages = [{ atoms: [] }, { atoms: [banner] }];
    const enlargedPages = [{ atoms: [] }, { atoms: [] }, { atoms: [] }, { atoms: [banner] }];

    expect(pageIndexForNote(compactPages, "harp-solo")).toBe(1);
    expect(pageIndexForNote(enlargedPages, "harp-solo")).toBe(3);
    expect(pageIndexForNote(enlargedPages, "missing")).toBe(-1);
  });

  it("records the absolute character offset of a continued paragraph", () => {
    expect(readingAnchorForPage({ atoms: [fragment(60, 100)] })).toEqual({
      atomId: "note:p1",
      offset: 60,
    });
  });

  it("returns to the fragment containing that offset after repagination", () => {
    const pages = [
      { atoms: [fragment(0, 40)] },
      { atoms: [fragment(40, 80)] },
      { atoms: [fragment(80, 120)] },
    ];

    expect(pageHoldingAnchor(pages, { atomId: "note:p1", offset: 60 })).toBe(1);
  });

  it("does not confuse a later fragment with the paragraph's first page", () => {
    const pages = [
      { atoms: [fragment(0, 70)] },
      { atoms: [fragment(70, 140)] },
    ];

    expect(pageHoldingAnchor(pages, { atomId: "note:p1", offset: 95 })).toBe(1);
  });

  it("falls back to an atom id for indivisible content", () => {
    const pages = [{ atoms: [] }, { atoms: [{ id: "note:w4", kind: "work-card", payload: {} }] }];

    expect(pageHoldingAnchor(pages, { atomId: "note:w4", offset: null })).toBe(1);
    expect(pageHoldingAnchor(pages, { atomId: "missing", offset: null })).toBe(-1);
  });

  it("restores an anchor only when it belongs to the current page history entry", () => {
    const anchor = { atomId: "note:p1", offset: 95 };
    const state = { route: "notes-book", page: 14, notesAnchor: anchor };

    expect(readingAnchorFromHistory(state, 14)).toEqual(anchor);
    expect(readingAnchorFromHistory(state, 13)).toBeNull();
    expect(readingAnchorFromHistory({ ...state, route: "pdf" }, 14)).toBeNull();
  });
});
