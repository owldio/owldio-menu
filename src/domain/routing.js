const READER_VIEWS = new Set(["entrance", "contents", "chapter", "pdf", "notes-book"]);

function validReaderView(view, fallback = "pdf") {
  return READER_VIEWS.has(view) ? view : fallback;
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function parseReaderHash(hash) {
  const value = String(hash || "").replace(/^#/, "");
  if (!value) {
    return { view: "pdf" };
  }

  if (READER_VIEWS.has(value)) {
    return { view: value };
  }

  if (value.startsWith("chapter/")) {
    const chapterSlug = decodeSegment(value.slice("chapter/".length));
    if (chapterSlug) {
      return { view: "chapter", chapterSlug };
    }
  }

  if (value.startsWith("note/")) {
    const noteSlug = decodeSegment(value.slice("note/".length));
    if (noteSlug) {
      return { view: "notes-book", noteSlug };
    }
  }

  if (value.startsWith("page/")) {
    const page = Number(decodeSegment(value.slice("page/".length)));
    if (Number.isInteger(page) && page > 0) {
      return { view: "notes-book", page };
    }
  }

  return { view: "entrance" };
}

/**
 * Alternative editions of a programme, read at /<slug>/<edition>: the same
 * content set another way, for the reader layouts each edition can set.
 * "copy" is a notes book on paper (月光紙).
 */
const EDITIONS = new Map([["copy", new Set(["notes-book"])]]);

export function editionFits(edition, readerLayout) {
  return EDITIONS.get(edition)?.has(readerLayout) ?? false;
}

/**
 * Before editions, /<a>/copy could only mean client a's programme "copy". When
 * the edition does not fit what /<a> holds, the address is read that way again,
 * so an older link keeps working.
 */
export function legacyReadingOf(route) {
  if (!route?.edition) return null;

  const { edition, programmeSlug, ...rest } = route;
  return { ...rest, clientSlug: programmeSlug, programmeSlug: edition, legacyPath: true };
}

export function parseAppLocation(pathname, hash) {
  const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";

  if (normalizedPath === "/") {
    return { kind: "shelf", view: "shelf" };
  }

  if (normalizedPath === "/admin") {
    return { kind: "admin" };
  }

  const rawSegments = normalizedPath.split("/").filter(Boolean);
  if (rawSegments.length === 2 && EDITIONS.has(rawSegments[1])) {
    const programmeSlug = decodeSegment(rawSegments[0]);
    if (!programmeSlug) return { kind: "not-found" };

    return {
      kind: "programme",
      programmeSlug,
      edition: rawSegments[1],
      ...parseReaderHash(hash),
    };
  }

  if (rawSegments.length === 1) {
    const programmeSlug = decodeSegment(rawSegments[0]);
    if (!programmeSlug) return { kind: "not-found" };

    return {
      kind: "programme",
      programmeSlug,
      ...parseReaderHash(hash),
    };
  }

  if (rawSegments.length !== 2) {
    return { kind: "not-found" };
  }

  const [clientSlug, programmeSlug] = rawSegments.map(decodeSegment);
  if (!clientSlug || !programmeSlug) {
    return { kind: "not-found" };
  }

  return {
    kind: "programme",
    clientSlug,
    programmeSlug,
    legacyPath: true,
    ...parseReaderHash(hash),
  };
}

export function buildProgrammePath(programmeSlug, { edition } = {}) {
  const path = `/${encodeURIComponent(programmeSlug)}`;
  return edition ? `${path}/${encodeURIComponent(edition)}` : path;
}

export function buildProgrammeReaderPath(programmeSlug) {
  return buildProgrammePath(programmeSlug);
}

/** The shelf at / is not written yet. Set to true to give the reader its way out. */
export const SHELF_PUBLISHED = false;

/** The one published programme, which stands in for the shelf until it exists. */
export const FALLBACK_PROGRAMME_SLUG = "moonlight-promise";

/**
 * Where a way-back control goes. Until the shelf is published it stops at the
 * programme the reader already has open — or, with none open, at the published
 * programme — rather than at an empty index.
 */
export function backDestination(programmeSlug, { shelfPublished = SHELF_PUBLISHED } = {}) {
  if (shelfPublished) return "/";
  return buildProgrammePath(programmeSlug || FALLBACK_PROGRAMME_SLUG);
}

export function isProgrammeReaderHash(hash) {
  const value = String(hash || "").replace(/^#/, "");
  if (!value) return true;
  if (READER_VIEWS.has(value)) return true;

  const prefix = ["chapter/", "note/", "page/"].find((candidate) => value.startsWith(candidate));
  if (!prefix) return false;

  const segment = decodeSegment(value.slice(prefix.length));
  if (!segment) return false;
  if (prefix !== "page/") return true;

  const page = Number(segment);
  return Number.isInteger(page) && page > 0;
}

export function resolveProgrammeReaderView({ requestedView, hash, defaultView }) {
  const hashValue = String(hash || "").replace(/^#/, "");
  if (hashValue && isProgrammeReaderHash(hash)) return validReaderView(requestedView);
  if (hashValue) return validReaderView(defaultView);
  return validReaderView(defaultView, validReaderView(requestedView));
}

export function resolveProgrammeLayoutView({ readerLayout, view }) {
  // The notes book is the whole web edition; only the printed leaflet sits beside it.
  if (readerLayout === "notes-book") return view === "pdf" ? "pdf" : "notes-book";
  return validReaderView(view);
}

/**
 * The note a hash points at. `#chapter/<slug>` predates the notes book and
 * names the same material, so it resolves to the same anchor.
 */
export function resolveNoteAnchor(hash) {
  const route = parseReaderHash(hash);
  return route.noteSlug || route.chapterSlug || null;
}

export function buildProgrammeViewUrl(pathname, { view, chapterSlug, defaultView }) {
  const normalizedView = validReaderView(view);
  const normalizedDefault = validReaderView(defaultView);
  if (normalizedView === normalizedDefault) return pathname;

  const hash = normalizedView === "chapter" && chapterSlug
    ? `chapter/${encodeURIComponent(chapterSlug)}`
    : normalizedView;
  return `${pathname}#${hash}`;
}
