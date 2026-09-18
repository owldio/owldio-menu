import { describe, expect, it } from "vitest";

import { buildNoteFlow } from "../src/domain/notes-flow.js";
import { buildSpreads, packAtoms } from "../src/domain/notes-pagination.js";

const LINE_HEIGHT = 30;
const CAPACITY = 300;
const CHARS_PER_LINE = 10;

const FULL_PAGE_KINDS = new Set(["cover", "colophon"]);

function measure(atom) {
  if (FULL_PAGE_KINDS.has(atom.kind)) return CAPACITY;
  if (atom.kind === "note-banner") return LINE_HEIGHT * 2;
  if (atom.kind === "work-card") return LINE_HEIGHT * 3;
  if (atom.kind.startsWith("contents-")) return LINE_HEIGHT * 3;
  const length = atom.payload.text.length;
  return Math.max(1, Math.ceil(length / CHARS_PER_LINE)) * LINE_HEIGHT;
}

function splitParagraph(atom, availableHeight) {
  const lines = Math.floor(availableHeight / LINE_HEIGHT);
  const chars = lines * CHARS_PER_LINE;
  if (chars <= 0) return null;

  const { text } = atom.payload;
  const head = text.slice(0, chars);
  const tail = text.slice(chars);
  if (!head || !tail) return null;

  return {
    head: { ...atom, payload: { ...atom.payload, text: head } },
    tail: { ...atom, payload: { ...atom.payload, text: tail } },
  };
}

const options = { capacity: CAPACITY, lineHeight: LINE_HEIGHT, measure, splitParagraph };

function paragraph(id, text, noteSlug = "note-a") {
  return { id, kind: "paragraph", noteSlug, noteIndex: 0, splittable: true, payload: { text } };
}

function banner(noteSlug, noteIndex = 0) {
  return {
    id: `${noteSlug}:banner`,
    kind: "note-banner",
    noteSlug,
    noteIndex,
    splittable: false,
    payload: { number: "01", title: noteSlug },
  };
}

function workCard(id, noteSlug = "note-a") {
  return { id, kind: "work-card", noteSlug, noteIndex: 0, splittable: false, payload: { title: id } };
}

function fullPage(kind) {
  return { id: kind, kind, noteSlug: null, noteIndex: null, splittable: false, payload: {} };
}

function contentsHeading() {
  return { id: "contents", kind: "contents-heading", noteSlug: null, noteIndex: null, splittable: false, payload: {} };
}

function contentsEntry(id) {
  return { id, kind: "contents-entry", noteSlug: null, noteIndex: null, splittable: false, payload: {} };
}

function repeat(char, count) {
  return char.repeat(count);
}

/** Rebuild the original atom list by joining consecutive fragments that share an id. */
function flatten(pages) {
  const joined = [];
  for (const page of pages) {
    for (const atom of page.atoms) {
      const previous = joined.at(-1);
      if (previous && previous.id === atom.id && atom.kind === "paragraph") {
        previous.payload = { ...previous.payload, text: previous.payload.text + atom.payload.text };
        continue;
      }
      joined.push({ ...atom, payload: { ...atom.payload } });
    }
  }
  return joined;
}

function usedHeight(page) {
  return page.atoms.reduce((total, atom) => total + measure(atom), 0);
}

describe("packAtoms page composition", () => {
  it("gives the cover and the colophon a page each, and opens the contents on its own", () => {
    const atoms = [
      fullPage("cover"),
      contentsHeading(),
      contentsEntry("c1"),
      banner("note-a"),
      paragraph("p1", repeat("甲", 20)),
      fullPage("colophon"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages.map((page) => page.kind)).toEqual(["cover", "contents", "note", "colophon"]);
    expect(pages[0].atoms).toHaveLength(1);
    expect(pages[1].atoms.map((atom) => atom.id)).toEqual(["contents", "c1"]);
    expect(pages[3].atoms).toHaveLength(1);
  });

  it("runs a long contents onto a second contents page", () => {
    const entries = Array.from({ length: 6 }, (_, index) => contentsEntry(`c${index}`));
    const atoms = [contentsHeading(), ...entries, banner("note-a"), paragraph("p1", repeat("甲", 20))];

    const pages = packAtoms(atoms, options);

    expect(pages.map((page) => page.kind)).toEqual(["contents", "contents", "contents", "note"]);
    expect(flatten(pages)).toEqual(atoms);
  });

  it("numbers pages sequentially from zero", () => {
    const atoms = [fullPage("cover"), paragraph("p1", repeat("甲", 200)), fullPage("colophon")];

    const pages = packAtoms(atoms, options);

    expect(pages.map((page) => page.index)).toEqual([...pages.keys()]);
  });

  it("labels each note page with the note it belongs to", () => {
    const atoms = [banner("note-a"), paragraph("p1", repeat("甲", 20), "note-a")];

    const pages = packAtoms(atoms, options);

    expect(pages).toHaveLength(1);
    expect(pages[0].noteSlug).toBe("note-a");
  });

  it("carries the running note onto pages that only continue it", () => {
    const atoms = [banner("note-a"), paragraph("p1", repeat("甲", 200), "note-a")];

    const pages = packAtoms(atoms, options);

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.noteSlug).toBe("note-a");
  });

  it("keeps every page within capacity when the content can fit", () => {
    const atoms = [
      banner("note-a"),
      paragraph("p1", repeat("甲", 120), "note-a"),
      paragraph("p2", repeat("乙", 80), "note-a"),
      workCard("w1"),
    ];

    const pages = packAtoms(atoms, options);

    for (const page of pages) {
      expect(usedHeight(page)).toBeLessThanOrEqual(CAPACITY);
    }
  });
});

describe("packAtoms typographic guards", () => {
  it("opens every note on a fresh page, however much room is left", () => {
    const atoms = [
      banner("note-a"),
      paragraph("p1", repeat("甲", 20), "note-a"),
      banner("note-b", 1),
      paragraph("p2", repeat("乙", 20), "note-b"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages).toHaveLength(2);
    expect(pages[0].atoms.map((atom) => atom.id)).toEqual(["note-a:banner", "p1"]);
    expect(pages[1].atoms.map((atom) => atom.id)).toEqual(["note-b:banner", "p2"]);
  });

  it("never leaves two notes sharing a page", () => {
    const atoms = [
      paragraph("p1", repeat("甲", 40), "note-a"),
      banner("note-b", 1),
      paragraph("p2", repeat("乙", 40), "note-b"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages).toHaveLength(2);
    expect(pages[0].noteSlug).toBe("note-a");
    expect(pages[1].noteSlug).toBe("note-b");
  });

  it("never splits a work card", () => {
    const atoms = [
      paragraph("p1", repeat("甲", 90), "note-a"),
      workCard("w1"),
      workCard("w2"),
      workCard("w3"),
    ];

    const pages = packAtoms(atoms, options);
    const cardIds = pages.flatMap((page) =>
      page.atoms.filter((atom) => atom.kind === "work-card").map((atom) => atom.id),
    );

    expect(cardIds).toEqual(["w1", "w2", "w3"]);
    expect(new Set(cardIds).size).toBe(3);
  });

  it("leaves at least two lines on each side of a split paragraph", () => {
    const atoms = [
      paragraph("p1", repeat("甲", 45), "note-a"),
      paragraph("p2", repeat("乙", 200), "note-a"),
    ];

    const pages = packAtoms(atoms, options);
    const fragments = pages.flatMap((page) => page.atoms.filter((atom) => atom.id === "p2"));

    expect(fragments.length).toBeGreaterThan(1);
    for (const fragment of fragments) {
      expect(measure(fragment)).toBeGreaterThanOrEqual(LINE_HEIGHT * 2);
    }
  });

  it("moves a paragraph whole rather than leave a sliver of it behind", () => {
    // Three lines are left; the paragraph needs eight. Splitting would strand
    // its opening lines at the foot of the page, so it starts the next page.
    const atoms = [
      paragraph("p1", repeat("甲", 70), "note-a"),
      paragraph("p2", repeat("乙", 80), "note-a"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages.map((page) => page.atoms.map((atom) => atom.id))).toEqual([["p1"], ["p2"]]);
  });

  it("still splits a paragraph when most of it fits on the page", () => {
    const atoms = [
      paragraph("p1", repeat("甲", 40), "note-a"),
      paragraph("p2", repeat("乙", 80), "note-a"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages).toHaveLength(2);
    expect(pages[0].atoms.map((atom) => atom.id)).toEqual(["p1", "p2"]);
    expect(pages[1].atoms.map((atom) => atom.id)).toEqual(["p2"]);
  });

  it("splits a long paragraph once four of its lines still fit", () => {
    // Four lines are left; the paragraph needs ten. Less than half of it fits,
    // but four lines are a passage rather than a sliver, and moving the whole
    // paragraph on would leave a hole at the foot of the page instead.
    const atoms = [
      paragraph("p1", repeat("甲", 60), "note-a"),
      paragraph("p2", repeat("乙", 100), "note-a"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages.map((page) => page.atoms.map((atom) => atom.id))).toEqual([["p1", "p2"], ["p2"]]);
    expect(flatten(pages)).toEqual(atoms);
  });

  it("asks for a shorter cut when none can end the page at full length", () => {
    // In the full room the measurer finds no cut it will take — a closing mark
    // would carry the head onto another line — but one line less works.
    const fussy = (atom, availableHeight) => (
      availableHeight >= LINE_HEIGHT * 4 ? null : splitParagraph(atom, availableHeight)
    );
    const atoms = [
      paragraph("p1", repeat("甲", 60), "note-a"),
      paragraph("p2", repeat("乙", 100), "note-a"),
    ];

    const pages = packAtoms(atoms, { ...options, splitParagraph: fussy });

    expect(pages.map((page) => page.atoms.map((atom) => atom.id))).toEqual([["p1", "p2"], ["p2"]]);
    expect(flatten(pages)).toEqual(atoms);
  });

  it("moves a whole paragraph forward when fewer than two lines remain", () => {
    const atoms = [
      paragraph("p1", repeat("甲", 90), "note-a"),
      paragraph("p2", repeat("乙", 40), "note-a"),
    ];

    const pages = packAtoms(atoms, options);

    expect(pages[0].atoms.map((atom) => atom.id)).toEqual(["p1"]);
    expect(pages[1].atoms.map((atom) => atom.id)).toEqual(["p2"]);
  });
});

describe("buildSpreads", () => {
  it("opens with the cover alone, then pairs facing pages", () => {
    expect(buildSpreads(6, true)).toEqual([[0], [1, 2], [3, 4], [5]]);
  });

  it("pairs evenly when the page count leaves no odd leaf", () => {
    expect(buildSpreads(5, true)).toEqual([[0], [1, 2], [3, 4]]);
  });

  it("gives every page its own spread on a single-page reader", () => {
    expect(buildSpreads(3, false)).toEqual([[0], [1], [2]]);
  });

  it("returns nothing for an empty book", () => {
    expect(buildSpreads(0, true)).toEqual([]);
    expect(buildSpreads(0, false)).toEqual([]);
  });
});

describe("packAtoms content conservation", () => {
  it("returns every atom, in order, with no text lost", () => {
    const atoms = [
      fullPage("cover"),
      contentsHeading(),
      contentsEntry("c1"),
      banner("note-a"),
      paragraph("p1", repeat("甲", 235), "note-a"),
      paragraph("p2", repeat("乙", 71), "note-a"),
      banner("note-b", 1),
      paragraph("p3", repeat("丙", 412), "note-b"),
      workCard("w1", "note-b"),
      fullPage("colophon"),
    ];

    const pages = packAtoms(atoms, options);

    expect(flatten(pages)).toEqual(atoms);
  });

  it("splits a paragraph taller than a whole page instead of dropping it", () => {
    const atoms = [paragraph("p1", repeat("甲", 1_000), "note-a")];

    const pages = packAtoms(atoms, options);

    expect(pages.length).toBeGreaterThan(3);
    expect(flatten(pages)).toEqual(atoms);
  });

  it("conserves the real programme notes end to end", async () => {
    const { moonlightPromiseChapters } = await import("../src/data/moonlight-promise-notes.js");
    const atoms = buildNoteFlow({
      programme: { title: "月光下的約定", intermission_after_position: 2 },
      chapters: moonlightPromiseChapters,
    });

    const pages = packAtoms(atoms, options);

    expect(flatten(pages)).toEqual(atoms);
    expect(pages.at(0).kind).toBe("cover");
    expect(pages.at(-1).kind).toBe("colophon");
  });
});
