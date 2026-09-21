function textRange(atom) {
  if (atom?.kind !== "paragraph") return null;
  const text = String(atom.payload?.text ?? "");
  const start = Number.isInteger(atom.payload?.sourceStart) ? atom.payload.sourceStart : 0;
  const end = Number.isInteger(atom.payload?.sourceEnd) ? atom.payload.sourceEnd : start + text.length;
  return { start, end };
}

/** The semantic reading position survives page-size and font-metric changes. */
export function readingAnchorForPage(page) {
  const atom = page?.atoms?.[0];
  if (!atom?.id) return null;
  const range = textRange(atom);
  return {
    atomId: atom.id,
    offset: range?.start ?? null,
  };
}

/** Find the reflowed page that still contains the saved character offset. */
export function pageHoldingAnchor(pages, anchor) {
  if (!anchor?.atomId) return -1;
  let firstMatchingPage = -1;

  for (let pageIndex = 0; pageIndex < (pages || []).length; pageIndex += 1) {
    for (const atom of pages[pageIndex]?.atoms || []) {
      if (atom.id !== anchor.atomId) continue;
      if (firstMatchingPage < 0) firstMatchingPage = pageIndex;
      if (!Number.isInteger(anchor.offset)) return pageIndex;

      const range = textRange(atom);
      if (!range) return pageIndex;
      if (range.start <= anchor.offset && anchor.offset < range.end) return pageIndex;
      if (range.start === range.end && anchor.offset === range.start) return pageIndex;
    }
  }

  return firstMatchingPage;
}

/** A numeric page hash may restore its semantic position only from the same history entry. */
export function readingAnchorFromHistory(state, page) {
  const anchor = state?.notesAnchor;
  if (state?.route !== "notes-book" || state?.page !== page || !anchor?.atomId) return null;
  if (anchor.offset !== null && !Number.isInteger(anchor.offset)) return null;
  return { atomId: anchor.atomId, offset: anchor.offset };
}
