const READER_VIEWS = new Set(["entrance", "contents", "chapter", "pdf"]);

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
