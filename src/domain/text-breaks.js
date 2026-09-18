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
