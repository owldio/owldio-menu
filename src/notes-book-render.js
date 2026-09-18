import { programmeDateLabel, programmeTimeLabel } from "./domain/datetime.js";
import { createElement } from "./lib/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * One fixed page for every device, in the proportions of a printed A4 leaf.
 * The stage scales this down to fit; zoom scales it back up for close reading.
 */
export const PAGE = {
  width: 800,
  height: 1131,
  paddingX: 80,
  paddingTop: 92,
  paddingBottom: 84,
  fontSize: 16,
  lineHeight: 30.4,
};

export const TEXT_WIDTH = PAGE.width - PAGE.paddingX * 2;
export const PAGE_CAPACITY = PAGE.height - PAGE.paddingTop - PAGE.paddingBottom;

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
    viewBox: "0 0 240 300",
    "aria-hidden": "true",
    focusable: "false",
  });

  const petals = [
    { x: 24, y: 40, rotate: -18, scale: 1 },
    { x: 148, y: 18, rotate: 26, scale: 0.72 },
    { x: 86, y: 132, rotate: 8, scale: 0.55 },
    { x: 186, y: 212, rotate: -34, scale: 0.86 },
  ];

  for (const petal of petals) {
    svg.append(
      svgElement("path", {
        d: "M0 26 C -8 14, -6 0, 6 -8 C 12 -12, 14 -16, 15 -22 C 16 -16, 18 -12, 24 -8 C 36 0, 38 14, 30 26 C 24 22, 20 20, 15 20 C 10 20, 6 22, 0 26 Z",
        transform: `translate(${petal.x} ${petal.y}) rotate(${petal.rotate}) scale(${petal.scale})`,
        fill: "currentColor",
        opacity: 0.2,
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
  node.append(goldSwoosh("note-cover__swoosh"), sakuraDrift("note-cover__sakura"));

  const copy = createElement("div", "note-cover__copy");
  copy.append(
    createElement("p", "note-cover__kicker", `${payload.kicker} / PROGRAMME NOTES`),
    createElement("h1", "note-cover__title", payload.title),
  );
  if (payload.summary) {
    copy.append(createElement("p", "note-cover__summary", payload.summary));
  }
  copy.append(
    ledger([
      ["日期", programmeDateLabel({ starts_at: payload.startsAt })],
      ["時間", programmeTimeLabel({ starts_at: payload.startsAt })],
      ["場地", payload.venue],
    ]),
  );

  node.append(copy);
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

function renderBanner(payload) {
  const node = createElement("header", "note-banner");
  const copy = createElement("div", "note-banner__copy");

  if (payload.eyebrow) {
    copy.append(createElement("p", "note-banner__eyebrow", payload.eyebrow));
  }
  copy.append(createElement("h2", "note-banner__title", payload.title));
  if (payload.titleEn) {
    copy.append(createElement("p", "note-banner__english", payload.titleEn));
  }
  if (payload.author) {
    copy.append(createElement("p", "note-banner__author", payload.author));
  }

  node.append(createElement("span", "note-banner__number", payload.number), copy);
  return node;
}

function renderParagraph(atom) {
  const node = createElement("p", "note-paragraph", atom.payload.text);
  if (atom.payload.continues) node.dataset.continues = "true";
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
export function createPageFrame({ runningHead = "", folioLabel = "00" } = {}) {
  const article = createElement("article", "note-page");
  const body = createElement("div", "note-page__body");

  const folio = createElement("footer", "note-page__folio");
  folio.append(
    createElement("span", null, runningHead),
    createElement("span", "note-page__folio-number", folioLabel),
  );

  article.append(body, folio);
  return { article, body };
}

export function renderPage(page, { total, runningHead }) {
  const { article, body } = createPageFrame({
    runningHead,
    folioLabel: folioNumber(page.index),
  });

  article.dataset.pageKind = page.kind;
  article.dataset.pageIndex = String(page.index);
  if (page.noteSlug) article.dataset.noteSlug = page.noteSlug;
  article.setAttribute("aria-label", `第 ${page.index + 1} 頁，共 ${total} 頁`);

  for (const atom of page.atoms) body.append(renderAtom(atom));

  return article;
}
