const FULL_PAGE_KINDS = new Set(["cover", "colophon"]);

/** A note, or the contents, always starts on a page of its own. */
const PAGE_OPENERS = new Set(["note-banner", "contents-heading"]);

function pageKindFor(atom) {
  return atom.kind.startsWith("contents-") ? "contents" : "note";
}
const MIN_LINES = 2;

/**
 * A paragraph that would fit on a page of its own is only split when at least
 * this share of it, or at least MIN_SPLIT_LINES of it, fits where it stands.
 * Below both, the few lines left behind read as a fragment and the reader meets
 * a sentence broken across a turn. Above either, what stays is a passage — and
 * moving a long paragraph on whole would leave a hole at the foot of the page.
 */
const MIN_SPLIT_SHARE = 0.5;
const MIN_SPLIT_LINES = 4;

function pageNoteSlug(atoms) {
  return atoms.find((atom) => atom.noteSlug)?.noteSlug ?? null;
}

/**
 * Cut a paragraph so that both halves keep at least MIN_LINES, shrinking the
 * budget until the tail is long enough — or until the measurer finds a cut it
 * will take, which a line less of room can give it. Returns null when no honest
 * cut exists.
 */
function splitWithGuards(atom, available, { lineHeight, measure, splitParagraph }) {
  const minimum = lineHeight * MIN_LINES;
  if (available < minimum) return null;

  let budget = available;

  for (let attempt = 0; attempt < 6 && budget >= minimum; attempt += 1) {
    const split = splitParagraph(atom, budget);
    if (!split?.head || !split?.tail) {
      budget -= lineHeight;
      continue;
    }

    const headHeight = measure(split.head);
    const tailHeight = measure(split.tail);

    if (headHeight > available || headHeight < minimum) {
      budget -= lineHeight;
      continue;
    }

    if (tailHeight < minimum) {
      budget -= minimum - tailHeight;
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

    // A paragraph longer than a whole page has to be split wherever it falls.
    const worthSplitting = height > capacity
      || remaining >= height * MIN_SPLIT_SHARE
      || remaining >= lineHeight * MIN_SPLIT_LINES;

    if (atom.splittable && worthSplitting) {
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
