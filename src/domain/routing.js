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

export function parseAppLocation(pathname, hash) {
  const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";

  if (normalizedPath === "/") {
    return { kind: "shelf", view: "shelf" };
  }

  if (normalizedPath === "/admin") {
    return { kind: "admin" };
  }

  const rawSegments = normalizedPath.split("/").filter(Boolean);
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

export function buildProgrammePath(programmeSlug) {
  return `/${encodeURIComponent(programmeSlug)}`;
}

export function buildProgrammeReaderPath(programmeSlug) {
  return buildProgrammePath(programmeSlug);
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
