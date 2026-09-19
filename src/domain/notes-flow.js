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

/**
 * The contents flows like any other text: a heading, then one line per work,
 * so a long programme or a large type size simply runs onto a second page.
 */
function contentsAtoms(programme, notes) {
  const intermissionAfter = Number(programme?.intermission_after_position) || 0;
  const atoms = [
    atom("contents-heading", {
      id: "contents",
      payload: { title: programme?.contents_title ?? "樂曲解說" },
    }),
  ];

  notes.forEach((chapter, index) => {
    atoms.push(
      atom("contents-entry", {
        id: `contents:${chapter.slug}`,
        payload: {
          number: noteNumber(index),
          title: chapter.title,
          titleEn: chapter.title_en ?? null,
          slug: chapter.slug,
        },
      }),
    );

    const isLast = index === notes.length - 1;
    if (intermissionAfter && chapter.position === intermissionAfter && !isLast) {
      atoms.push(
        atom("contents-intermission", {
          id: "contents:intermission",
          payload: { title: INTERMISSION_TITLE },
        }),
      );
    }
  });

  return atoms;
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

/**
 * A note's title names the composer before the work — 「格蘭查尼：古典風格的詠嘆調」,
 * "Marcel Grandjany: Aria in Classic Style". Split at the first colon so an
 * opening page can set the two apart; a title without one is all work.
 */
export function splitNoteTitle(title) {
  const text = typeof title === "string" ? title.trim() : "";
  const match = text.match(/^(.+?)\s*[：:]\s*(.+)$/u);
  if (!match) return { composer: null, work: text || null };
  return { composer: match[1], work: match[2] };
}

function noteAtoms(chapter, index) {
  const { composer, work } = splitNoteTitle(chapter.title);
  const english = splitNoteTitle(chapter.title_en);
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
        composer,
        work,
        composerEn: english.composer,
        workEn: english.work,
        author: chapter.author ?? null,
        ensemble: chapter.ensemble ?? null,
        performers: chapter.performers ?? [],
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
            // The opening paragraph is the note's way in, and is set as a lede.
            payload: { text, lede: paragraphCount === 1 },
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

/**
 * A paragraph cut where a page ends. The tail carries on at the top of the next
 * page, unindented, and a lede's tail is set as body text: the gold stroke that
 * marks a note's opening paragraph belongs on the note's opening page alone.
 */
export function cutParagraph(paragraph, cut) {
  const { text } = paragraph.payload;
  return {
    head: { ...paragraph, payload: { ...paragraph.payload, text: text.slice(0, cut) } },
    tail: {
      ...paragraph,
      payload: { ...paragraph.payload, text: text.slice(cut), continues: true, lede: false },
    },
  };
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
        presenter: programme?.presenter ?? null,
      },
    }),
    ...contentsAtoms(programme, notes),
    ...notes.flatMap((chapter, index) => noteAtoms(chapter, index)),
    atom("colophon", {
      id: "colophon",
      payload: {
        title: programme?.title ?? "",
        venue: programme?.venue ?? null,
        startsAt: programme?.starts_at ?? null,
        productionType: programme?.production_type ?? null,
        presenter: programme?.presenter ?? null,
        supporters: programme?.supporters ?? [],
        sponsors: programme?.sponsors ?? [],
      },
    }),
  ];
}
