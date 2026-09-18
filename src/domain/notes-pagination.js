const FULL_PAGE_KINDS = new Set(["cover", "contents", "colophon"]);
const MIN_LINES = 2;

function firstNoteSlug(atoms) {
  return atoms.find((atom) => atom.noteSlug)?.noteSlug ?? null;
}

/**
 * Cut a paragraph so that both halves keep at least MIN_LINES, shrinking the
 * budget until the tail is long enough. Returns null when no honest cut exists.
 */
function splitWithGuards(atom, available, { lineHeight, measure, splitParagraph }) {
  const minimum = lineHeight * MIN_LINES;
  if (available < minimum) return null;

  let budget = available;

  for (let attempt = 0; attempt < 6 && budget >= minimum; attempt += 1) {
    const split = splitParagraph(atom, budget);
    if (!split?.head || !split?.tail) return null;

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

/**
 * A banner that ends up as the last thing on a page reads as a heading with no
 * article under it. The reserve in packAtoms prevents almost every case; this
 * catches the rest, such as a banner followed by an unsplittable card.
 */
function rescueStrandedBanners(pages) {
  for (let index = 0; index < pages.length - 1; index += 1) {
    const page = pages[index];
    if (page.atoms.length < 2) continue;
    if (page.atoms.at(-1)?.kind !== "note-banner") continue;

    const banner = page.atoms.pop();
    const next = pages[index + 1];
    next.atoms.unshift(banner);
    page.noteSlug = firstNoteSlug(page.atoms);
    next.noteSlug = firstNoteSlug(next.atoms);
  }
}

export function packAtoms(atoms, { capacity, lineHeight, measure, splitParagraph }) {
  const pages = [];
  const queue = [...(atoms || [])];

  let current = null;
  let used = 0;

  function place(atom, height) {
    if (!current) {
      current = { index: pages.length, kind: "note", noteSlug: null, atoms: [] };
      pages.push(current);
      used = 0;
    }
    current.atoms.push(atom);
    used += height;
    if (!current.noteSlug && atom.noteSlug) current.noteSlug = atom.noteSlug;
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

    const height = measure(atom);
    const remaining = current ? capacity - used : capacity;
    // A banner must carry the opening lines of its note onto the same page.
    const needed = atom.kind === "note-banner" ? height + lineHeight * MIN_LINES : height;

    if (needed <= remaining) {
      place(atom, height);
      continue;
    }

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

  rescueStrandedBanners(pages);

  return pages;
}
