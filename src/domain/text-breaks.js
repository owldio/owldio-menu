/**
 * Where a paragraph may be cut when it has to run onto the next page. A reader
 * picks up a complete sentence far more easily than half of one, so a cut
 * prefers the end of a sentence, then the end of a clause.
 */

const SENTENCE_END = /[。！？]/;
const CLAUSE_END = /[；：，、]/;
const CLOSERS = /[」』）》〉】”’]/;
const WORD_CHARACTER = /[A-Za-z0-9'’.\-–—]/;
const BREAK_SEARCH_LIMIT = 24;

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

const CJK_MARK = /[。！？；：，、「」『』（）《》〈〉【】“”‘’…—–·]/u;
const GUARDED_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}〇々]/u;
const GUARDED_LENGTH = 2;
const MINIMUM_GUARDED_TEXT = 12;

/**
 * Where a paragraph's closing run begins: its last two characters and every
 * mark among and after them (「《碎心花》等。」 keeps 「花》等。」), which the
 * page holds on one line so a paragraph never ends on a lone character. -1 for
 * a paragraph too short to strand one, or one ending on a Latin word or a
 * number, which the browser already keeps whole.
 */
export function orphanGuardStart(text) {
  const value = typeof text === "string" ? text : "";
  if (value.length < MINIMUM_GUARDED_TEXT) return -1;

  let index = value.length;
  let guarded = 0;
  while (index > 0 && guarded < GUARDED_LENGTH) {
    const character = value[index - 1];
    if (GUARDED_CHARACTER.test(character)) guarded += 1;
    else if (!CJK_MARK.test(character)) return -1;
    index -= 1;
  }
  return guarded === GUARDED_LENGTH ? index : -1;
}

/**
 * Chinese alone is set justified, so a line that gave a character to the next
 * still meets the margin; a Latin word would be pulled apart, so a paragraph
 * with one stays ragged.
 */
export function setsJustified(text) {
  return !/[A-Za-z]/u.test(String(text ?? ""));
}

export function sentenceBreak(text, limit) {
  return lastBreakBefore(text, limit, SENTENCE_END);
}

export function clauseBreak(text, limit) {
  return lastBreakBefore(text, limit, CLAUSE_END);
}

/**
 * Use the full amount of text the browser measured onto the page. Punctuation
 * does not pull the cut backwards; only a Latin word or number is kept whole.
 */
export function lineBreak(text, limit) {
  const value = String(text ?? "");
  let cut = Math.min(Math.max(0, limit), value.length);
  let steps = 0;

  while (
    cut > 1
    && cut < value.length
    && steps < BREAK_SEARCH_LIMIT
    && WORD_CHARACTER.test(value[cut - 1])
    && WORD_CHARACTER.test(value[cut])
  ) {
    cut -= 1;
    steps += 1;
  }

  return cut;
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
