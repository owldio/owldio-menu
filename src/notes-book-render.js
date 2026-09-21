import { programmeDateParts } from "./domain/datetime.js";
import { shouldShowFolio } from "./domain/notes-geometry.js";
import { createElement } from "./lib/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Below this width the banner stacks its number above the title. */
const NARROW_PAGE = 520;

/** A book's folio is a plain number; the reader's rail keeps the padded form. */
function folioNumber(index) {
  return String(index + 1);
}

function svgElement(tagName, attributes) {
  const node = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

/**
 * The gold ribbon that runs under the printed cover. Drawn rather than
 * imported so it stays crisp at any zoom level.
 */
function goldSwoosh(className) {
  const svg = svgElement("svg", {
    class: className,
    viewBox: "0 0 800 320",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
  });

  const curves = [
    "M-40 250 C 180 130, 420 300, 860 120",
    "M-40 285 C 200 170, 440 330, 860 160",
    "M-40 214 C 160 96, 400 262, 860 78",
  ];

  curves.forEach((definition, index) => {
    svg.append(
      svgElement("path", {
        d: definition,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": index === 0 ? 1.6 : 0.8,
        opacity: index === 0 ? 0.75 : 0.34,
      }),
    );
  });

  return svg;
}

function sakuraDrift(className) {
  const svg = svgElement("svg", {
    class: className,
    viewBox: "0 0 260 360",
    "aria-hidden": "true",
    focusable: "false",
  });

  const petals = [
    { x: 30, y: 44, rotate: -22, scale: 1, opacity: 0.4 },
    { x: 162, y: 20, rotate: 28, scale: 0.7, opacity: 0.3 },
    { x: 96, y: 138, rotate: 6, scale: 0.52, opacity: 0.24 },
    { x: 206, y: 186, rotate: -38, scale: 0.84, opacity: 0.34 },
    { x: 52, y: 250, rotate: 48, scale: 0.46, opacity: 0.2 },
    { x: 150, y: 306, rotate: -12, scale: 0.62, opacity: 0.26 },
  ];

  for (const petal of petals) {
    svg.append(
      svgElement("path", {
        d: "M0 24 C -7 12, -5 -1, 6 -9 C 11 -13, 13 -17, 14 -23 C 15 -17, 17 -13, 22 -9 C 33 -1, 35 12, 28 24 C 22 20, 18 18, 14 18 C 10 18, 6 20, 0 24 Z",
        transform: `translate(${petal.x} ${petal.y}) rotate(${petal.rotate}) scale(${petal.scale})`,
        fill: "currentColor",
        opacity: petal.opacity,
      }),
    );
  }

  return svg;
}

/** The moon the programme is named for, cropped by the page edge. */
function moonDisc(className) {
  const svg = svgElement("svg", {
    class: className,
    viewBox: "0 0 300 300",
    "aria-hidden": "true",
    focusable: "false",
  });

  svg.append(
    svgElement("circle", {
      cx: 150,
      cy: 150,
      r: 118,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.2,
      opacity: 0.55,
    }),
    svgElement("circle", {
      cx: 150,
      cy: 150,
      r: 132,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 0.6,
      opacity: 0.24,
    }),
    svgElement("circle", {
      cx: 150,
      cy: 150,
      r: 104,
      fill: "currentColor",
      opacity: 0.07,
    }),
  );

  return svg;
}

/** Harp strings: the instrument that carries this programme, drawn as light. */
function harpStrings(className) {
  const svg = svgElement("svg", {
    class: className,
    viewBox: "0 0 260 900",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
  });

  for (let index = 0; index < 11; index += 1) {
    const x = 18 + index * 22;
    svg.append(
      svgElement("path", {
        d: `M${x} 0 C ${x + 14} 260, ${x + 26} 560, ${x + 52} 900`,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": index % 3 === 0 ? 0.9 : 0.5,
        opacity: index % 3 === 0 ? 0.34 : 0.18,
      }),
    );
  }

  return svg;
}

function ledger(rows) {
  const list = createElement("dl", "note-ledger");
  for (const [label, value] of rows) {
    if (!value) continue;
    const row = createElement("div");
    row.append(createElement("dt", null, label), createElement("dd", null, value));
    list.append(row);
  }
  return list;
}

function renderCover(payload) {
  if (payload.artwork?.url) return printedPage(payload.artwork);

  const node = createElement("section", "note-cover");
  node.append(
    moonDisc("note-cover__moon"),
    harpStrings("note-cover__strings"),
    goldSwoosh("note-cover__swoosh"),
    sakuraDrift("note-cover__sakura"),
  );

  const copy = createElement("div", "note-cover__copy");
  copy.append(
    createElement("p", "note-cover__kicker", `${payload.kicker} / PROGRAMME NOTES`),
    createElement("h1", "note-cover__title", payload.title),
  );
  if (payload.summary) {
    copy.append(createElement("p", "note-cover__summary", payload.summary));
  }

  const parts = programmeDateParts({ starts_at: payload.startsAt });
  if (parts) copy.append(coverDate(parts));

  copy.append(
    ledger([
      ["場地", payload.venue],
      ["主辦", payload.presenter],
      ["贊助", payload.sponsors?.join("、") || null],
    ]),
  );

  node.append(copy);
  return node;
}

/** The date set large, as on the printed leaflet: 2026 / 9.25（五）19:30. */
function coverDate({ year, monthDay, weekday, time }) {
  const node = createElement("p", "note-cover__date");
  node.append(
    createElement("span", "note-cover__year", year),
    createElement("strong", "note-cover__day", monthDay),
    createElement("span", "note-cover__time", `（${weekday}）${time}`),
  );
  return node;
}

function renderContentsHeading(payload) {
  const node = createElement("header", "note-contents");
  node.append(
    createElement("p", "note-contents__kicker", "PROGRAMME"),
    createElement("h2", "note-contents__title", payload.title),
    // No arrow marks the links: an arrow is the first thing a thumb finds.
    createElement("p", "note-contents__hint", "點曲名可直接跳到該首解說"),
  );
  return node;
}

/** The players of a block, set in phrasing content so an entry stays one button. */
function scoringLine(performers) {
  const line = createElement("span", "note-contents__performers");
  for (const [role, name] of performers) {
    const performer = createElement("span", "note-contents__performer");
    performer.append(
      createElement("span", "note-contents__role", role),
      createElement("span", "note-contents__name", name),
    );
    line.append(performer);
  }
  return line;
}

/**
 * A line under an entry: a movement of the work, or one of the pieces played
 * in it. A line of its own, so the list flows and a page can break between two.
 */
function renderContentsSub(payload, variant) {
  const line = createElement("p", `note-contents__sub note-contents__sub--${variant}`);
  line.append(createElement("span", "note-contents__sub-mark", payload.mark));

  const copy = createElement("span", "note-contents__sub-copy");
  copy.append(createElement("span", null, payload.title));
  if (payload.titleEn) copy.append(createElement("small", null, payload.titleEn));

  line.append(copy);
  return line;
}

function renderContentsEntry(payload) {
  const button = createElement("button", "note-contents__link");
  button.type = "button";
  button.dataset.noteSlug = payload.slug;

  const copy = createElement("span", "note-contents__copy");
  if (payload.ensemble) {
    copy.append(createElement("span", "note-contents__ensemble", payload.ensemble));
    if (payload.performers?.length) copy.append(scoringLine(payload.performers));
  }
  // Only the work's own title follows the link, and only as far as its own
  // letters reach: everything else on the page is page, and turns the leaf.
  copy.append(createElement("strong", "note-contents__title-link", payload.title));
  if (payload.titleEn) copy.append(createElement("small", null, payload.titleEn));

  button.append(createElement("span", "note-contents__number", payload.number), copy);
  return button;
}

function renderContentsIntermission(payload) {
  const node = createElement("p", "note-contents__intermission");
  node.append(createElement("span", null, payload.title));
  return node;
}

function performerLine(performers) {
  const list = createElement("ul", "note-banner__performers");
  for (const [role, name] of performers) {
    const item = createElement("li");
    item.append(
      createElement("span", "note-banner__role", role),
      createElement("span", "note-banner__name", name),
    );
    list.append(item);
  }
  return list;
}

/** Line, lozenge, line: the one ornament a note's opening page carries. */
function ornament(className) {
  const svg = svgElement("svg", {
    class: className,
    viewBox: "0 0 88 10",
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.append(
    svgElement("path", { d: "M0 5 H36", fill: "none", stroke: "currentColor", "stroke-opacity": 0.6, "stroke-width": 0.8 }),
    svgElement("path", { d: "M44 1 L48 5 L44 9 L40 5 Z", fill: "currentColor", "fill-opacity": 0.85 }),
    svgElement("path", { d: "M52 5 H88", fill: "none", stroke: "currentColor", "stroke-opacity": 0.6, "stroke-width": 0.8 }),
  );
  return svg;
}

/**
 * A note opens like a page of the printed programme: scoring, number, the work
 * set large, its English beneath, then the composer, an ornament and the
 * players, all on the centre line.
 */
function renderBanner(payload) {
  const node = createElement("header", "note-banner");
  // The scoring says what kind of piece this is; the generic "programme note"
  // label only fills in when a note has no scoring of its own.
  const scoring = payload.ensemble || payload.eyebrow || "樂曲解說";

  const title = createElement("h2", "note-banner__title", payload.work || payload.title);
  // However it is set, the heading is heard as the whole title.
  if (payload.work && payload.work !== payload.title) title.setAttribute("aria-label", payload.title);

  node.append(
    moonDisc("note-banner__moon"),
    createElement("p", "note-banner__eyebrow", scoring),
    createElement("span", "note-banner__number", payload.number),
    title,
  );

  const english = payload.composer ? payload.workEn || payload.titleEn : payload.titleEn;
  if (english) node.append(createElement("p", "note-banner__english", english));

  // A "composer" that only repeats the scoring (豎琴獨奏) is left out.
  if (payload.composer && payload.composer !== scoring) {
    const composer = createElement("p", "note-banner__composer", payload.composer);
    if (payload.composerEn) {
      const latin = createElement("span", "note-banner__composer-en", payload.composerEn);
      latin.lang = "en";
      composer.append(latin);
    }
    node.append(composer);
  }

  // The author wrote the note; saying so keeps her apart from the performer list.
  if (payload.author) {
    node.append(createElement("p", "note-banner__author", `文／${payload.author}`));
  }
  node.append(ornament("note-banner__ornament"));
  if (payload.performers?.length) {
    node.append(performerLine(payload.performers));
  }
  return node;
}

function renderParagraph(atom) {
  const { text, lede, leadIn = 0, continues } = atom.payload;
  const node = createElement("p", "note-paragraph");
  // A lede leads with its first phrase in gold (leadPhraseLength); only the colour changes, never the measure.
  if (lede && leadIn > 0) {
    node.append(createElement("span", "note-paragraph__lead", text.slice(0, leadIn)), text.slice(leadIn));
  } else {
    node.textContent = text;
  }
  if (continues) node.dataset.continues = "true";
  if (lede) node.dataset.lede = "true";
  return node;
}

function renderWorkCard(payload) {
  const node = createElement("section", "note-work");
  const heading = createElement("header", "note-work__heading");
  heading.append(
    createElement("span", "note-work__number", payload.number),
    createElement("h3", null, payload.title),
  );
  node.append(heading);

  if (payload.titleEn) {
    node.append(createElement("p", "note-work__english", payload.titleEn));
  }
  for (const detail of payload.details) {
    node.append(createElement("p", "note-work__detail", detail));
  }

  return node;
}

/**
 * A performer's opening: a round portrait and an identity block share one row,
 * so the biography begins immediately beneath them on every page size.
 */
function renderPersonBanner(payload) {
  const node = createElement("header", "note-person");

  if (payload.portrait?.url) {
    const figure = createElement("figure", "note-person__portrait");
    const image = createElement("img");
    image.src = payload.portrait.url;
    image.width = payload.portrait.width;
    image.height = payload.portrait.height;
    image.alt = payload.name ? `${payload.name}` : "";
    image.decoding = "async";
    image.style.objectPosition = payload.portrait.position || "50% 35%";
    figure.append(image);
    node.append(figure);
  }

  const identity = createElement("div", "note-person__identity");
  if (payload.role) identity.append(createElement("p", "note-person__role", payload.role));
  identity.append(createElement("h2", "note-person__name", payload.name));
  if (payload.nameEn) {
    const english = createElement("p", "note-person__english", payload.nameEn);
    english.lang = "en";
    identity.append(english);
  }
  identity.append(ornament("note-person__ornament"));
  node.append(identity);

  return node;
}

/** A page that is a printed panel itself: the sheet's own artwork, whole. */
function printedPage(image) {
  const node = createElement("section", "note-printed");
  const artwork = createElement("img");
  artwork.src = image.url;
  artwork.width = image.width;
  artwork.height = image.height;
  artwork.alt = image.alt || "";
  artwork.decoding = "async";

  if (image.wideUrl) {
    const picture = createElement("picture");
    const wide = createElement("source");
    wide.media = "(min-width: 900px) and (orientation: landscape)";
    wide.srcset = image.wideUrl;
    picture.append(wide, artwork);
    node.append(picture);
  } else {
    node.append(artwork);
  }
  return node;
}

/** The sponsor's page, printed as it stands; its type is part of the picture. */
function renderBackCover(payload) {
  return printedPage(payload);
}

export function renderAtom(atom) {
  switch (atom.kind) {
    case "cover":
      return renderCover(atom.payload);
    case "contents-heading":
      return renderContentsHeading(atom.payload);
    case "contents-entry":
      return renderContentsEntry(atom.payload);
    case "contents-movement":
      return renderContentsSub(atom.payload, "movement");
    case "contents-work":
      return renderContentsSub(atom.payload, "work");
    case "contents-intermission":
      return renderContentsIntermission(atom.payload);
    case "note-banner":
      return renderBanner(atom.payload);
    case "paragraph":
      return renderParagraph(atom);
    case "work-card":
      return renderWorkCard(atom.payload);
    case "person-banner":
      return renderPersonBanner(atom.payload);
    case "back-cover":
      return renderBackCover(atom.payload);
    default:
      return createElement("div");
  }
}

/**
 * Page size, margins and type size travel as custom properties, so every rule
 * in the stylesheet can be written in proportion to the page it sits on.
 */
function applyPageLayout(article, layout) {
  article.style.width = `${layout.width}px`;
  article.style.height = `${layout.height}px`;
  article.style.setProperty("--page-width", `${layout.width}px`);
  article.style.setProperty("--page-height", `${layout.height}px`);
  article.style.setProperty("--page-pad-x", `${layout.padX}px`);
  article.style.setProperty("--page-pad-top", `${layout.padTop}px`);
  article.style.setProperty("--page-pad-bottom", `${layout.padBottom}px`);
  article.style.setProperty("--note-font", `${layout.font}px`);
  article.dataset.narrow = layout.width < NARROW_PAGE ? "true" : "false";
  article.dataset.compact = layout.compact ? "true" : "false";
}

/**
 * An empty page with its body and folio in place. The measurer builds one too,
 * so the height it reports for the body is the height atoms actually get.
 *
 * The folio is only the page number, set in the bottom margin as a reading app
 * sets it; the running head at the top already says which note this is.
 */
export function createPageFrame({ folioLabel = "00", layout, showFolio = true } = {}) {
  const article = createElement("article", "note-page");
  if (layout) applyPageLayout(article, layout);
  const body = createElement("div", "note-page__body");

  article.append(body);
  if (showFolio) {
    const folio = createElement("footer", "note-page__folio");
    folio.append(createElement("span", "note-page__folio-number", folioLabel));
    article.append(folio);
  }
  return { article, body };
}

/** The mark that closes a note, so a short final page ends rather than stops. */
function endMark() {
  const node = createElement("p", "note-page__endmark");
  node.setAttribute("aria-hidden", "true");
  node.append(
    createElement("i"),
    createElement("span", null, "✦"),
    createElement("i"),
  );
  return node;
}

export function renderPage(page, { total, continuedLabel, endsNote, layout }) {
  const { article, body } = createPageFrame({
    folioLabel: folioNumber(page.index),
    layout,
    showFolio: shouldShowFolio(page.kind),
  });

  article.dataset.pageKind = page.kind;
  article.dataset.pageIndex = String(page.index);
  if (page.noteSlug) article.dataset.noteSlug = page.noteSlug;
  article.setAttribute("aria-label", `第 ${page.index + 1} 頁，共 ${total} 頁`);

  for (const atom of page.atoms) body.append(renderAtom(atom));
  if (endsNote) {
    article.dataset.endsNote = "true";
    body.append(endMark());
  }

  // A continuing page needs a head of its own. It lives in the page margin, so
  // it costs the text block nothing and the measured capacity stays honest.
  const opensANote = page.atoms.some((atom) => atom.kind === "note-banner");
  if (continuedLabel && !opensANote) {
    const running = createElement("p", "note-page__running", continuedLabel);
    running.setAttribute("aria-hidden", "true");
    article.prepend(running);
  }

  return article;
}
