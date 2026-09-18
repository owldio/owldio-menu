const INTERMISSION_TITLE = "中場休息";

function visibleChapters(chapters) {
  return (chapters || []).filter((chapter) => chapter?.is_visible !== false);
}

function noteNumber(index) {
  return String(index + 1).padStart(2, "0");
}

function atom(kind, { id, noteSlug = null, noteIndex = null, payload = {} }) {
  return {
    id,
    kind,
    noteSlug,
    noteIndex,
    splittable: kind === "paragraph",
    payload,
  };
}

function contentsEntries(programme, notes) {
  const intermissionAfter = Number(programme?.intermission_after_position) || 0;
  const entries = [];

  notes.forEach((chapter, index) => {
    entries.push({
      kind: "note",
      number: noteNumber(index),
      title: chapter.title,
      titleEn: chapter.title_en ?? null,
      slug: chapter.slug,
    });

    const isLast = index === notes.length - 1;
    if (intermissionAfter && chapter.position === intermissionAfter && !isLast) {
      entries.push({ kind: "intermission", title: INTERMISSION_TITLE });
    }
  });

  return entries;
}

function workCardPayload(item) {
  const [number, title, detail, duration] = item;
  const lines = String(detail || "").split("\n");
  const titleEn = lines.shift() || null;

  return {
    number,
    title,
    titleEn,
    details: lines.filter(Boolean),
    duration: duration || null,
  };
}

function noteAtoms(chapter, index) {
  const atoms = [
    atom("note-banner", {
      id: `${chapter.slug}:banner`,
      noteSlug: chapter.slug,
      noteIndex: index,
      payload: {
        number: noteNumber(index),
        eyebrow: chapter.eyebrow || null,
        title: chapter.title,
        titleEn: chapter.title_en ?? null,
        author: chapter.author ?? null,
      },
    }),
  ];

  let paragraphCount = 0;
  let cardCount = 0;

  for (const block of chapter.blocks || []) {
    if (block.type === "prose") {
      for (const text of (block.paragraphs || []).filter(Boolean)) {
        paragraphCount += 1;
        atoms.push(
          atom("paragraph", {
            id: `${chapter.slug}:p${paragraphCount}`,
            noteSlug: chapter.slug,
            noteIndex: index,
            payload: { text },
          }),
        );
      }
    }

    if (block.type === "programme-list") {
      for (const item of block.items || []) {
        cardCount += 1;
        atoms.push(
          atom("work-card", {
            id: `${chapter.slug}:w${cardCount}`,
            noteSlug: chapter.slug,
            noteIndex: index,
            payload: workCardPayload(item),
          }),
        );
      }
    }
  }

  return atoms;
}

export function buildNoteFlow({ programme, chapters }) {
  const notes = visibleChapters(chapters);

  return [
    atom("cover", {
      id: "cover",
      payload: {
        title: programme?.title ?? "",
        kicker: programme?.contents_title ?? "樂曲解說",
        summary: programme?.summary ?? null,
        venue: programme?.venue ?? null,
        startsAt: programme?.starts_at ?? null,
      },
    }),
    atom("contents", {
      id: "contents",
      payload: {
        title: programme?.contents_title ?? "樂曲解說",
        entries: contentsEntries(programme, notes),
      },
    }),
    ...notes.flatMap((chapter, index) => noteAtoms(chapter, index)),
    atom("colophon", {
      id: "colophon",
      payload: {
        title: programme?.title ?? "",
        venue: programme?.venue ?? null,
        startsAt: programme?.starts_at ?? null,
        productionType: programme?.production_type ?? null,
      },
    }),
  ];
}
