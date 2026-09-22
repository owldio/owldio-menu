import { leadPhraseLength } from "./text-breaks.js";

const INTERMISSION_TITLE = "中場休息";

/** 節目單 is the whole publication; this page is only the concert order. */
const PROGRAMME_TITLE = "曲序";

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
 * The movements of a work, and the pieces played inside one entry, each set as
 * a line of its own so a page can break between them rather than carry a whole
 * entry — or leave half a page empty for want of room.
 */
function subEntryAtoms(chapter) {
  const movements = (chapter.movements ?? []).map(([mark, title, titleEn], index) => atom("contents-movement", {
    id: `contents:${chapter.slug}:m${index + 1}`,
    payload: { mark, title, titleEn: titleEn ?? null, slug: chapter.slug },
  }));

  const works = (chapter.blocks ?? [])
    .filter((block) => block.type === "programme-list")
    .flatMap((block) => block.items ?? [])
    .map(([mark, title, detail], index) => atom("contents-work", {
      id: `contents:${chapter.slug}:w${index + 1}`,
      payload: {
        mark,
        title,
        titleEn: String(detail || "").split("\n")[0] || null,
        slug: chapter.slug,
      },
    }));

  return [...movements, ...works];
}

/**
 * The programme list, set as the tri-fold sets it: a scoring and its players
 * head each block, then the works, their movements and their pieces. It flows
 * like any other text, so a longer programme or larger type runs onto a second
 * page rather than shrinking.
 */
function contentsAtoms(programme, notes) {
  const intermissionAfter = Number(programme?.intermission_after_position) || 0;
  const atoms = [
    atom("contents-heading", {
      id: "contents",
      payload: { title: PROGRAMME_TITLE },
    }),
  ];

  let statedEnsemble = null;

  notes.forEach((chapter, index) => {
    const ensemble = chapter.ensemble ?? null;
    const opensBlock = Boolean(ensemble) && ensemble !== statedEnsemble;
    statedEnsemble = ensemble;

    atoms.push(
      atom("contents-entry", {
        id: `contents:${chapter.slug}`,
        payload: {
          number: noteNumber(index),
          title: chapter.title,
          titleEn: chapter.title_en ?? null,
          slug: chapter.slug,
          ensemble: opensBlock ? ensemble : null,
          performers: opensBlock ? (chapter.performers ?? []) : [],
        },
      }),
      ...subEntryAtoms(chapter),
    );

    const isLast = index === notes.length - 1;
    if (intermissionAfter && chapter.position === intermissionAfter && !isLast) {
      atoms.push(
        atom("contents-intermission", {
          id: "contents:intermission",
          payload: { title: INTERMISSION_TITLE },
        }),
      );
      // After the interval the programme states its scoring again.
      statedEnsemble = null;
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
  const customRunningHead = typeof chapter.running_head === "string"
    && chapter.running_head !== "title"
    ? chapter.running_head.trim()
    : null;
  const runningHead = customRunningHead || (
    chapter.running_head === "title"
      || !english.composer
      || !english.work
      ? null
      : { composer: english.composer, work: english.work }
  );
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
        runningHead,
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
        // The opening paragraph is the note's way in: a lede, led by its first phrase.
        const lede = paragraphCount === 1;
        atoms.push(
          atom("paragraph", {
            id: `${chapter.slug}:p${paragraphCount}`,
            noteSlug: chapter.slug,
            noteIndex: index,
            payload: { text, lede, leadIn: lede ? leadPhraseLength(text) : 0 },
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
 * page, unindented, and a lede's tail is set as body text: the gold phrase that
 * opens a note belongs on the note's opening page alone.
 */
export function cutParagraph(paragraph, cut) {
  const { text, leadIn = 0 } = paragraph.payload;
  const sourceStart = Number.isInteger(paragraph.payload.sourceStart)
    ? paragraph.payload.sourceStart
    : 0;
  const sourceEnd = Number.isInteger(paragraph.payload.sourceEnd)
    ? paragraph.payload.sourceEnd
    : sourceStart + text.length;
  const sourceCut = sourceStart + cut;
  return {
    head: {
      ...paragraph,
      payload: {
        ...paragraph.payload,
        text: text.slice(0, cut),
        leadIn: Math.min(leadIn, cut),
        sourceStart,
        sourceEnd: sourceCut,
      },
    },
    tail: {
      ...paragraph,
      payload: {
        ...paragraph.payload,
        text: text.slice(cut),
        continues: true,
        lede: false,
        leadIn: 0,
        sourceStart: sourceCut,
        sourceEnd,
      },
    },
  };
}

/**
 * A performer's pages: the portrait and the name, then the biography as it is
 * printed. The first paragraph is a lede, as a note's first paragraph is.
 * The programme places this whole section before the programme notes.
 */
function personAtoms(person) {
  return [
    atom("person-banner", {
      id: `${person.slug}:banner`,
      noteSlug: person.slug,
      payload: {
        role: person.role ?? null,
        name: person.name ?? "",
        nameEn: person.name_en ?? null,
        portrait: person.portrait ?? null,
      },
    }),
    ...(person.paragraphs ?? []).filter(Boolean).map((text, index) => atom("paragraph", {
      id: `${person.slug}:p${index + 1}`,
      noteSlug: person.slug,
      payload: {
        text,
        lede: index === 0,
        leadIn: index === 0 ? leadPhraseLength(text) : 0,
      },
    })),
  ];
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
        sponsors: programme?.sponsors ?? [],
        // A programme that was printed opens on its own printed cover.
        artwork: programme?.cover_artwork ?? null,
      },
    }),
    ...contentsAtoms(programme, notes),
    ...(programme?.people ?? []).flatMap(personAtoms),
    ...notes.flatMap((chapter, index) => noteAtoms(chapter, index)),
    ...(programme?.sponsor_pages ?? [])
      .filter((page) => page?.url)
      .map((page, index) => atom("sponsor-page", {
        id: `sponsor-page:${page.id ?? index + 1}`,
        payload: { ...page },
      })),
    ...(programme?.back_cover
      ? [atom("back-cover", { id: "back-cover", payload: { ...programme.back_cover } })]
      : []),
  ];
}
