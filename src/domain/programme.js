const PUBLIC_VISIBILITIES = new Set(["published", "unlisted"]);

const ALLOWED_TRANSITIONS = {
  draft: new Set(["unlisted", "published", "archived"]),
  unlisted: new Set(["draft", "published", "archived"]),
  published: new Set(["unlisted", "archived"]),
  archived: new Set(["draft"]),
};

export function isPubliclyReadable(programme) {
  return PUBLIC_VISIBILITIES.has(programme?.visibility);
}

export function isListedProgramme(programme) {
  return programme?.visibility === "published";
}

export function listedProgrammes(programmes) {
  return programmes.filter(isListedProgramme);
}

export function hasWebEdition(programme) {
  return programme?.chapters?.some((chapter) => chapter?.is_visible !== false) ?? false;
}

export function canTransitionVisibility(from, to) {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

export const programmeVisibilityLabels = {
  draft: "草稿",
  unlisted: "不列入索引",
  published: "已發布",
  archived: "已封存",
};
