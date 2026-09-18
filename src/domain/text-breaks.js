/**
 * Where a paragraph may be cut when it has to run onto the next page. A reader
 * picks up a complete sentence far more easily than half of one, so a cut
 * prefers the end of a sentence, then the end of a clause.
 */

const SENTENCE_END = /[。！？]/;
const CLAUSE_END = /[；：，、]/;
const CLOSERS = /[」』）》〉】”’]/;

/**
 * The latest cut at or before `limit` that falls just after a mark matching
 * `pattern`, carrying any closing quotes along with it. 0 when there is none.
 */
function lastBreakBefore(text, limit, pattern) {
  const end = Math.min(limit, text.length);

  for (let index = end - 1; index > 0; index -= 1) {
    if (!pattern.test(text[index])) continue;

    let cut = index + 1;
    while (cut < text.length && CLOSERS.test(text[cut])) cut += 1;
    if (cut <= end) return cut;
  }

  return 0;
}

export function sentenceBreak(text, limit) {
  return lastBreakBefore(text, limit, SENTENCE_END);
}

export function clauseBreak(text, limit) {
  return lastBreakBefore(text, limit, CLAUSE_END);
}

/**
 * How many lines a page may leave empty to end on a full sentence, or on a
 * clause. Counted in lines rather than in characters, so larger type does not
 * open ever larger holes at the foot of the page.
 */
export const BREAK_ALLOWANCE_LINES = Object.freeze({
  sentence: 2,
  clause: 1,
  line: Number.POSITIVE_INFINITY,
});

/**
 * The cut to end a page on. Candidates come in order of preference, each with
 * the height its head would take; the first that fits the room, keeps at least
 * the minimum head, and fills the page to within its allowance wins.
 */
export function chooseCut(candidates, { available, lineHeight, minimumHead = 0 }) {
  return candidates.find(({ kind, cut, height }) => (
    cut > 0
    && height >= minimumHead
    && height <= available
    && available - height <= BREAK_ALLOWANCE_LINES[kind] * lineHeight
  )) ?? null;
}
