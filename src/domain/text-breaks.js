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

const LEAD_END = /[，；：。！？]/;
const LEAD_OPENERS = /[（(「『《〈【]/;
const LEAD_CLOSERS = /[）)」』》〉】]/;
const GLOSS_CLOSERS = /[）)]/;

/** About two lines of a phone page; a longer phrase would turn the lede gold wholesale. */
const LEAD_LIMIT_EMS = 40;

/** Latin letters, digits and spaces take about half the width of a Chinese character. */
function emsOf(character) {
  return character.charCodeAt(0) < 0x2e80 ? 0.5 : 1;
}

/**
 * How many characters of a note's opening paragraph make up the phrase it
 * leads with: up to its first comma or full stop, or through the gloss that
 * follows a name — 格蘭查尼（Marcel Grandjany，1891－1975）. Punctuation inside
 * brackets does not end it; an enumeration comma does not either. 0 when no
 * phrase ends within LEAD_LIMIT_EMS.
 */
export function leadPhraseLength(text) {
  const value = String(text ?? "");
  let depth = 0;
  let ems = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (depth === 0 && LEAD_END.test(character)) return index;

    ems += emsOf(character);
    if (ems > LEAD_LIMIT_EMS) return 0;

    if (LEAD_OPENERS.test(character)) {
      depth += 1;
    } else if (depth > 0 && LEAD_CLOSERS.test(character)) {
      depth -= 1;
      if (depth === 0 && GLOSS_CLOSERS.test(character)) return index + 1;
    }
  }

  return 0;
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
