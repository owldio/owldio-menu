import { cutParagraph } from "./domain/notes-flow.js";
import { lineBreak } from "./domain/text-breaks.js";
import { createPageFrame, renderAtom } from "./notes-book-render.js";
import { createElement } from "./lib/dom.js";

const FULL_PAGE_KINDS = new Set(["cover", "sponsor-page", "back-cover"]);
const MINIMUM_SPLIT_LENGTH = 8;

/**
 * Lays atoms out in a hidden page of identical geometry so the pagination
 * engine can ask how tall each one really is. Fonts must already be ready.
 *
 * The host must be laid out: a `display: none` ancestor measures every atom as
 * zero, which silently collapses the whole book onto one page.
 */
export function createMeasurer(host = document.body, { layout } = {}) {
  const { article: frame, body } = createPageFrame({ folioLabel: "00", layout });
  frame.classList.add("note-page--measure");
  frame.setAttribute("aria-hidden", "true");
  host.append(frame);

  // The body is what atoms actually get: the page minus its padding and folio.
  const capacity = body.clientHeight;

  // A sentinel keeps the measured node away from :last-child and :only-child,
  // so a rule meant for the end of a page cannot shrink what we measure.
  const sentinel = createElement("span", "note-page__sentinel");

  function elementHeight(node) {
    body.replaceChildren(node, sentinel);
    const style = window.getComputedStyle(node);
    const margins = Number.parseFloat(style.marginTop || "0")
      + Number.parseFloat(style.marginBottom || "0");
    return node.getBoundingClientRect().height + margins;
  }

  function measure(atom) {
    if (FULL_PAGE_KINDS.has(atom.kind)) return capacity;
    return elementHeight(renderAtom(atom));
  }

  function splitParagraph(atom, availableHeight) {
    const { text } = atom.payload;
    if (!text || text.length < MINIMUM_SPLIT_LENGTH) return null;

    let low = 1;
    let high = text.length - 1;
    let best = 0;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const height = elementHeight(renderAtom(cutParagraph(atom, middle).head));
      if (height <= availableHeight) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (!best) return null;

    // Continue through the last measured line. A comma or full stop never
    // pulls text onto the next page and leaves an artificial hole here.
    const cut = lineBreak(text, best);
    if (cut <= 0 || cut >= text.length) return null;
    return cutParagraph(atom, cut);
  }

  function destroy() {
    frame.remove();
  }

  const probe = elementHeight(createElement("p", "note-paragraph", "量測探針"));
  if (!probe) {
    destroy();
    throw new Error("Notes measurer host is not laid out; every atom would measure zero.");
  }

  return { capacity, measure, splitParagraph, destroy };
}
