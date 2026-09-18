import {
  programmeDateLabel,
  programmeDateParts,
  programmeTimeLabel,
} from "./domain/datetime.js";
import { PAGE_WIDTH } from "./domain/notes-geometry.js";
import { createElement } from "./lib/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Width and type are fixed; height comes from the stage. */
export const PAGE = {
  width: PAGE_WIDTH,
  fontSize: 16,
  lineHeight: 30.4,
};

function folioNumber(index) {
  return String(index + 1).padStart(2, "0");
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

function contentsRow(entry) {
  const item = createElement("li", "note-contents__item");

  if (entry.kind === "intermission") {
    item.classList.add("note-contents__item--intermission");
    item.append(createElement("span", null, entry.title));
    return item;
  }

  const button = createElement("button", "note-contents__link");
  button.type = "button";
  button.dataset.noteSlug = entry.slug;

  const copy = createElement("span", "note-contents__copy");
  copy.append(createElement("strong", null, entry.title));
  if (entry.titleEn) copy.append(createElement("small", null, entry.titleEn));

  button.append(
    createElement("span", "note-contents__number", entry.number),
    copy,
    createElement("span", "note-contents__arrow", "→"),
  );
  item.append(button);
  return item;
}

function renderContents(payload) {
  const node = createElement("section", "note-contents");
  node.append(
    createElement("p", "note-contents__kicker", "CONTENTS"),
    createElement("h2", "note-contents__title", payload.title),
  );

  const list = createElement("ol", "note-contents__list");
  for (const entry of payload.entries) list.append(contentsRow(entry));
  node.append(list);

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

function renderBanner(payload) {
  const node = createElement("header", "note-banner");
  const copy = createElement("div", "note-banner__copy");

  // The scoring says what kind of piece this is; the generic "programme note"
  // label only fills in when a note has no scoring of its own.
  copy.append(
    createElement("p", "note-banner__eyebrow", payload.ensemble || payload.eyebrow || "樂曲解說"),
  );

  copy.append(createElement("h2", "note-banner__title", payload.title));
  if (payload.titleEn) {
    copy.append(createElement("p", "note-banner__english", payload.titleEn));
  }
  // The author wrote the note; saying so keeps her apart from the performer list.
  if (payload.author) {
    copy.append(createElement("p", "note-banner__author", `文／${payload.author}`));
  }
  if (payload.performers?.length) {
    copy.append(performerLine(payload.performers));
  }

  node.append(createElement("span", "note-banner__number", payload.number), copy);
  return node;
}

function renderParagraph(atom) {
  const node = createElement("p", "note-paragraph", atom.payload.text);
  if (atom.payload.continues) node.dataset.continues = "true";
  if (atom.payload.lede) node.dataset.lede = "true";
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

function renderColophon(payload) {
  const node = createElement("section", "note-colophon");
  node.append(goldSwoosh("note-colophon__swoosh"));

  const copy = createElement("div", "note-colophon__copy");
  copy.append(
    createElement("p", "note-colophon__kicker", "END OF PROGRAMME NOTES"),
    createElement("h2", "note-colophon__title", payload.title),
  );
  if (payload.productionType) {
    copy.append(createElement("p", "note-colophon__type", payload.productionType));
  }
  copy.append(
    ledger([
      ["日期", programmeDateLabel({ starts_at: payload.startsAt })],
      ["時間", programmeTimeLabel({ starts_at: payload.startsAt })],
      ["場地", payload.venue],
      ["主辦", payload.presenter],
      ["協辦", payload.supporters?.join("、") || null],
    ]),
  );

  const actions = createElement("div", "note-colophon__actions");
  const printed = createElement("button", "note-colophon__action", "翻閱印刷節目單");
  printed.type = "button";
  printed.dataset.notesRoute = "pdf";
  actions.append(printed);
  copy.append(actions);

  node.append(copy);
  return node;
}

export function renderAtom(atom) {
  switch (atom.kind) {
    case "cover":
      return renderCover(atom.payload);
    case "contents":
      return renderContents(atom.payload);
    case "note-banner":
      return renderBanner(atom.payload);
    case "paragraph":
      return renderParagraph(atom);
    case "work-card":
      return renderWorkCard(atom.payload);
    case "colophon":
      return renderColophon(atom.payload);
    default:
      return createElement("div");
  }
}

/**
 * An empty page with its body and folio in place. The measurer builds one too,
 * so the height it reports for the body is the height atoms actually get.
 */
export function createPageFrame({ runningHead = "", folioLabel = "00", height } = {}) {
  const article = createElement("article", "note-page");
  if (height) article.style.height = `${height}px`;
  const body = createElement("div", "note-page__body");

  const folio = createElement("footer", "note-page__folio");
  folio.append(
    createElement("span", null, runningHead),
    createElement("span", "note-page__folio-number", folioLabel),
  );

  article.append(body, folio);
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

export function renderPage(page, { total, runningHead, continuedLabel, endsNote, height }) {
  const { article, body } = createPageFrame({
    runningHead,
    folioLabel: folioNumber(page.index),
    height,
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
