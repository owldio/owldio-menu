const FULL_PAGE_KINDS = new Set(["cover", "back-cover"]);

/** A note, or the contents, always starts on a page of its own. */
const PAGE_OPENERS = new Set(["note-banner", "contents-heading", "person-banner"]);

function pageKindFor(atom) {
  return atom.kind.startsWith("contents-") ? "contents" : "note";
}
const MIN_HEAD_LINES = 2;
const MIN_TAIL_LINES = 1;

function pageNoteSlug(atoms) {
  return atoms.find((atom) => atom.noteSlug)?.noteSlug ?? null;
}

/**
 * Cut a paragraph with at least two lines at the foot of the page. A short
 * final line may continue on the next page: preserving the prose flow is more
 * useful here than leaving several usable lines empty.
 */
/**
 * The least height that still counts as `lines` whole lines. Browsers lay text
 * out on a 1/64 px grid, so n lines can measure a hair under n times the
 * nominal line height; half a line of slack tells rounding from a missing line.
 */
export function heightOfLines(lines, lineHeight) {
  return (lines - 0.5) * lineHeight;
}

function splitWithGuards(atom, available, { lineHeight, measure, splitParagraph }) {
  const minimumHead = heightOfLines(MIN_HEAD_LINES, lineHeight);
  const minimumTail = heightOfLines(MIN_TAIL_LINES, lineHeight);
  if (available < minimumHead) return null;

  let budget = available;

  for (let attempt = 0; attempt < 6 && budget >= minimumHead; attempt += 1) {
    const split = splitParagraph(atom, budget);
    if (!split?.head || !split?.tail) {
      budget -= lineHeight;
      continue;
    }

    const headHeight = measure(split.head);
    const tailHeight = measure(split.tail);

    if (headHeight > available || headHeight < minimumHead) {
      budget -= lineHeight;
      continue;
    }

    if (tailHeight < minimumTail) {
      budget -= minimumTail - tailHeight;
      continue;
    }

    return split;
  }

  return null;
}

function labelPages(pages) {
  for (const page of pages) {
    if (FULL_PAGE_KINDS.has(page.kind)) continue;
    page.noteSlug = pageNoteSlug(page.atoms);
  }
}

export function packAtoms(atoms, { capacity, lineHeight, measure, splitParagraph }) {
  const pages = [];
  const queue = [...(atoms || [])];

  let current = null;
  let used = 0;

  function place(atom, height) {
    if (!current) {
      current = { index: pages.length, kind: pageKindFor(atom), noteSlug: null, atoms: [] };
      pages.push(current);
      used = 0;
    }
    current.atoms.push(atom);
    used += height;
  }

  function closePage() {
    current = null;
    used = 0;
  }

  while (queue.length) {
    const atom = queue.shift();

    if (FULL_PAGE_KINDS.has(atom.kind)) {
      pages.push({
        index: pages.length,
        kind: atom.kind,
        noteSlug: atom.noteSlug ?? null,
        atoms: [atom],
      });
      closePage();
      continue;
    }

    // Every note opens on its own page: two works sharing a leaf reads as a
    // mistake, however much room the previous one left behind.
    if (PAGE_OPENERS.has(atom.kind) && current && current.atoms.length) {
      closePage();
    }

    const height = measure(atom);
    const remaining = current ? capacity - used : capacity;

    if (height <= remaining) {
      place(atom, height);
      continue;
    }

    // Fill every whole line that remains. The two-line guard keeps a readable
    // opening and tail, but paragraph length and punctuation never force an
    // otherwise usable part of the page to stay empty.
    if (atom.splittable) {
      const split = splitWithGuards(atom, remaining, { lineHeight, measure, splitParagraph });
      if (split) {
        place(split.head, measure(split.head));
        queue.unshift(split.tail);
        closePage();
        continue;
      }
    }

    if (current && current.atoms.length) {
      closePage();
      queue.unshift(atom);
      continue;
    }

    // The page is empty and the atom still does not fit. Never drop content:
    // place it and let this one page overflow.
    place(atom, height);
  }

  labelPages(pages);

  return pages;
}

/** Cover alone, then facing pairs — the way a bound book opens. */
export function buildSpreads(total, twoUp) {
  if (total <= 0) return [];
  if (!twoUp) return Array.from({ length: total }, (_, index) => [index]);

  const spreads = [[0]];
  for (let index = 1; index < total; index += 2) {
    spreads.push(index + 1 < total ? [index, index + 1] : [index]);
  }
  return spreads;
}
