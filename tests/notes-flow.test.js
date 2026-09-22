import { describe, expect, it } from "vitest";

import { buildNoteFlow, cutParagraph, splitNoteTitle } from "../src/domain/notes-flow.js";

describe("splitNoteTitle", () => {
  it("sets the composer apart from the work at the first colon", () => {
    expect(splitNoteTitle("格蘭查尼：古典風格的詠嘆調")).toEqual({ composer: "格蘭查尼", work: "古典風格的詠嘆調" });
    expect(splitNoteTitle("Marcel Grandjany: Aria in Classic Style")).toEqual({
      composer: "Marcel Grandjany",
      work: "Aria in Classic Style",
    });
  });

  it("keeps an arranger with the composer and the rest of the title with the work", () => {
    expect(splitNoteTitle("德布西／馬修諾庭 改編：《月光》")).toEqual({
      composer: "德布西／馬修諾庭 改編",
      work: "《月光》",
    });
    expect(splitNoteTitle("Johannes Brahms: Piano Quartet No. 3 in C Minor, Op. 60")).toEqual({
      composer: "Johannes Brahms",
      work: "Piano Quartet No. 3 in C Minor, Op. 60",
    });
  });

  it("reads a title without a colon as the work alone", () => {
    expect(splitNoteTitle("豎琴獨奏")).toEqual({ composer: null, work: "豎琴獨奏" });
    expect(splitNoteTitle(null)).toEqual({ composer: null, work: null });
  });
});

describe("cutParagraph", () => {
  const lede = {
    id: "work:p1",
    kind: "paragraph",
    noteSlug: "work",
    noteIndex: 0,
    splittable: true,
    payload: { text: "甲乙丙。丁戊己。", lede: true, leadIn: 3 },
  };

  it("keeps a lede's opening phrase on the note's opening page alone", () => {
    const { head, tail } = cutParagraph(lede, 4);
    const { head: shortHead } = cutParagraph(lede, 2);

    expect(head.payload.leadIn).toBe(3);
    expect(tail.payload.leadIn).toBe(0);
    expect(shortHead.payload.leadIn).toBe(2);
  });

  it("cuts a paragraph into a head and a tail that continues it, losing no text", () => {
    const { head, tail } = cutParagraph(lede, 4);

    expect(head.payload.text + tail.payload.text).toBe(lede.payload.text);
    expect([head.id, tail.id]).toEqual([lede.id, lede.id]);
    expect(head.payload.continues).toBeFalsy();
    expect(tail.payload.continues).toBe(true);
  });

  it("sets the part of a lede that runs onto the next page as body text", () => {
    const { head, tail } = cutParagraph(lede, 4);

    expect(head.payload.lede).toBe(true);
    expect(tail.payload.lede).toBe(false);
  });

  it("keeps a continuing paragraph continuing when it is cut again", () => {
    const { tail: middle } = cutParagraph(lede, 2);
    const { head } = cutParagraph(middle, 3);

    expect(head.payload.continues).toBe(true);
    expect(head.payload.lede).toBe(false);
  });

  it("keeps absolute text offsets when a paragraph is split more than once", () => {
    const { head: first, tail: remainder } = cutParagraph(lede, 2);
    const { head: middle, tail: last } = cutParagraph(remainder, 3);

    expect(first.payload).toMatchObject({ sourceStart: 0, sourceEnd: 2 });
    expect(middle.payload).toMatchObject({ sourceStart: 2, sourceEnd: 5 });
    expect(last.payload).toMatchObject({ sourceStart: 5, sourceEnd: lede.payload.text.length });
  });
});

const programme = {
  title: "月光下的約定",
  contents_title: "樂曲解說",
  venue: "國家兩廳院演奏廳",
  starts_at: "2026-09-25T19:30:00+08:00",
  intermission_after_position: 2,
  presenter: "主辦單位",
  supporters: ["協辦單位"],
  sponsors: ["贊助單位"],
};

const chapters = [
  {
    slug: "first-work",
    position: 1,
    title: "作曲家：第一首",
    title_en: "Composer: First Work",
    ensemble: "弦樂四重奏與豎琴",
    performers: [["豎琴", "甲"], ["小提琴 I", "乙"]],
    is_visible: true,
    blocks: [{ type: "prose", paragraphs: ["甲段落。", "乙段落。"] }],
  },
  {
    slug: "second-work",
    position: 2,
    title: "作曲家：第二首",
    title_en: "Composer: Second Work",
    running_head: "title",
    is_visible: true,
    movements: [["I.", "不太快的快板", "Allegro non troppo"], ["II.", "行板", "Andante"]],
    blocks: [{ type: "prose", paragraphs: ["丙段落。"] }],
  },
  {
    slug: "harp-solo",
    position: 3,
    title: "豎琴獨奏",
    title_en: null,
    author: "彩愛玲",
    is_visible: true,
    blocks: [
      { type: "prose", paragraphs: ["前言。"] },
      {
        type: "programme-list",
        items: [
          ["01", "櫻", "Sakura\n說明一。", ""],
          ["02", "雨夜花", "Torment of a Flower\n說明二。", ""],
        ],
      },
    ],
  },
  {
    slug: "hidden-work",
    position: 4,
    title: "不該出現",
    is_visible: false,
    blocks: [{ type: "prose", paragraphs: ["隱藏段落。"] }],
  },
];

function kindsOf(atoms) {
  return atoms.map((atom) => atom.kind);
}

describe("buildNoteFlow", () => {
  it("opens with the cover and its programme list, and keeps no colophon", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    expect(atoms.at(0).kind).toBe("cover");
    expect(atoms.at(1).kind).toBe("contents-heading");
    expect(atoms.some((atom) => atom.kind === "colophon")).toBe(false);
  });

  it("credits the presenter and the sponsors on the cover", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    expect(atoms.at(0).payload).toMatchObject({
      presenter: "主辦單位",
      sponsors: ["贊助單位"],
      venue: "國家兩廳院演奏廳",
    });
  });

  it("emits one banner per visible note, in programme order", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const banners = atoms.filter((atom) => atom.kind === "note-banner");

    expect(banners.map((atom) => atom.noteSlug)).toEqual([
      "first-work",
      "second-work",
      "harp-solo",
    ]);
    expect(banners.map((atom) => atom.payload.number)).toEqual(["01", "02", "03"]);
  });

  it("uses an English composer and work for continuation heads unless a note opts out", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const banners = atoms.filter((atom) => atom.kind === "note-banner");

    expect(banners[0].payload.runningHead).toEqual({
      composer: "Composer",
      work: "First Work",
    });
    expect(banners[1].payload.runningHead).toBeNull();
    expect(banners[2].payload.runningHead).toBeNull();
  });

  it("accepts a compact continuation head without changing the opening title", () => {
    const [chapter] = chapters;
    const atoms = buildNoteFlow({
      programme,
      chapters: [{
        ...chapter,
        running_head: "Debussy (arr. Naughtin) Clair de Lune",
      }],
    });
    const banner = atoms.find((atom) => atom.kind === "note-banner");

    expect(banner.payload.titleEn).toBe("Composer: First Work");
    expect(banner.payload.runningHead).toBe("Debussy (arr. Naughtin) Clair de Lune");
  });

  it("carries the author onto the banner when a note has one", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const harp = atoms.find((atom) => atom.kind === "note-banner" && atom.noteSlug === "harp-solo");

    expect(harp.payload.author).toBe("彩愛玲");
  });

  it("expands prose blocks into one paragraph atom per paragraph", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const paragraphs = atoms.filter(
      (atom) => atom.kind === "paragraph" && atom.noteSlug === "first-work",
    );

    expect(paragraphs.map((atom) => atom.payload.text)).toEqual(["甲段落。", "乙段落。"]);
  });

  it("expands a programme list into one work card per item", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const cards = atoms.filter((atom) => atom.kind === "work-card");

    expect(cards).toHaveLength(2);
    expect(cards[0].payload).toMatchObject({
      number: "01",
      title: "櫻",
      titleEn: "Sakura",
      details: ["說明一。"],
    });
  });

  it("keeps blocks in their authored order within a note", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const harpAtoms = atoms.filter((atom) => atom.noteSlug === "harp-solo");

    expect(kindsOf(harpAtoms)).toEqual(["note-banner", "paragraph", "work-card", "work-card"]);
  });

  it("omits chapters that are not visible", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    expect(atoms.some((atom) => atom.noteSlug === "hidden-work")).toBe(false);
  });

  it("lists every visible note in the contents, with the intermission in place", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const contents = atoms.filter((atom) => atom.kind.startsWith("contents-"));

    expect(contents.map((atom) => atom.kind)).toEqual([
      "contents-heading",
      "contents-entry",
      "contents-entry",
      "contents-movement",
      "contents-movement",
      "contents-intermission",
      "contents-entry",
      "contents-work",
      "contents-work",
    ]);
    expect(contents[1].payload).toEqual({
      number: "01",
      title: "作曲家：第一首",
      titleEn: "Composer: First Work",
      slug: "first-work",
      ensemble: "弦樂四重奏與豎琴",
      performers: [["豎琴", "甲"], ["小提琴 I", "乙"]],
    });
    expect(contents[5].payload).toEqual({ title: "中場休息" });
    expect(contents[6].payload.titleEn).toBeNull();
  });

  it("names the list 曲序 so 節目單 refers to the whole publication", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    expect(atoms.find((atom) => atom.kind === "contents-heading").payload).toEqual({ title: "曲序" });
  });

  it("states a scoring once per block, and restates it after the intermission", () => {
    const atoms = buildNoteFlow({
      programme,
      chapters: chapters.map((chapter) => ({ ...chapter, ensemble: "弦樂四重奏與豎琴" })),
    });
    const entries = atoms.filter((atom) => atom.kind === "contents-entry");

    expect(entries.map((atom) => atom.payload.ensemble)).toEqual([
      "弦樂四重奏與豎琴",
      null,
      "弦樂四重奏與豎琴",
    ]);
  });

  it("sets a work's movements and its pieces as lines of their own, so a page can break between them", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    expect(atoms.filter((atom) => atom.kind === "contents-movement").map((atom) => atom.payload)).toEqual([
      { mark: "I.", title: "不太快的快板", titleEn: "Allegro non troppo", slug: "second-work" },
      { mark: "II.", title: "行板", titleEn: "Andante", slug: "second-work" },
    ]);
    expect(atoms.filter((atom) => atom.kind === "contents-work").map((atom) => atom.payload)).toEqual([
      { mark: "01", title: "櫻", titleEn: "Sakura", slug: "harp-solo" },
      { mark: "02", title: "雨夜花", titleEn: "Torment of a Flower", slug: "harp-solo" },
    ]);
  });

  it("keeps the programme list clear of note slugs, so its pages take no running head", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const list = atoms.filter((atom) => atom.kind.startsWith("contents-"));

    expect(list.every((atom) => atom.noteSlug === null)).toBe(true);
  });

  it("leaves the intermission out when the programme does not declare one", () => {
    const atoms = buildNoteFlow({
      programme: { ...programme, intermission_after_position: null },
      chapters,
    });

    expect(atoms.some((atom) => atom.kind === "contents-intermission")).toBe(false);
  });


  it("carries the scoring onto the banner so a note reads like a programme entry", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const banner = atoms.find((atom) => atom.kind === "note-banner" && atom.noteSlug === "first-work");

    expect(banner.payload.ensemble).toBe("弦樂四重奏與豎琴");
    expect(banner.payload.performers).toEqual([["豎琴", "甲"], ["小提琴 I", "乙"]]);
  });

  it("gives the banner the composer and the work apart, in both languages", () => {
    const atoms = buildNoteFlow({
      programme,
      chapters: [{
        slug: "aria",
        position: 1,
        title: "格蘭查尼：古典風格的詠嘆調",
        title_en: "Marcel Grandjany: Aria in Classic Style",
        is_visible: true,
        blocks: [],
      }],
    });
    const banner = atoms.find((atom) => atom.kind === "note-banner");

    expect(banner.payload).toMatchObject({
      title: "格蘭查尼：古典風格的詠嘆調",
      composer: "格蘭查尼",
      work: "古典風格的詠嘆調",
      composerEn: "Marcel Grandjany",
      workEn: "Aria in Classic Style",
    });
  });

  it("leaves the scoring empty when a note does not declare one", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const banner = atoms.find((atom) => atom.kind === "note-banner" && atom.noteSlug === "second-work");

    expect(banner.payload.ensemble).toBeNull();
    expect(banner.payload.performers).toEqual([]);
  });

  it("marks the opening paragraph of each note as its lede", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const ledes = atoms.filter((atom) => atom.kind === "paragraph" && atom.payload.lede);

    expect(ledes.map((atom) => atom.noteSlug)).toEqual(["first-work", "second-work", "harp-solo"]);
    expect(ledes[0].payload.text).toBe("甲段落。");
  });

  it("sets apart the opening phrase of a note's lede, and of no other paragraph", () => {
    const atoms = buildNoteFlow({
      programme,
      chapters: [{
        slug: "grandjany",
        position: 1,
        title: "格蘭查尼：古典風格的詠嘆調",
        is_visible: true,
        blocks: [{
          type: "prose",
          paragraphs: ["格蘭查尼（Marcel Grandjany，1891－1975）出生於巴黎，是豎琴家。", "他自幼學琴，後進入巴黎音樂院。"],
        }],
      }],
    });
    const [lede, body] = atoms.filter((atom) => atom.kind === "paragraph");

    expect(lede.payload.text.slice(0, lede.payload.leadIn)).toBe("格蘭查尼（Marcel Grandjany，1891－1975）");
    expect(body.payload.leadIn).toBe(0);
  });

  it("marks only paragraphs as splittable", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    for (const atom of atoms) {
      expect(atom.splittable).toBe(atom.kind === "paragraph");
    }
  });

  it("gives every atom a unique id", () => {
    const atoms = buildNoteFlow({ programme, chapters });
    const ids = atoms.map((atom) => atom.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("introduces each performer after the programme list and before the notes", () => {
    const atoms = buildNoteFlow({
      programme: {
        ...programme,
        people: [{
          slug: "harpist",
          role: "豎琴",
          name: "甲",
          name_en: "A",
          portrait: { url: "harp.webp", width: 4, height: 3 },
          paragraphs: ["第一段。", "第二段。"],
        }],
      },
      chapters,
    });
    const person = atoms.filter((atom) => atom.noteSlug === "harpist");

    expect(kindsOf(person)).toEqual(["person-banner", "paragraph", "paragraph"]);
    expect(person[0].payload).toEqual({
      role: "豎琴",
      name: "甲",
      nameEn: "A",
      portrait: { url: "harp.webp", width: 4, height: 3 },
    });
    expect(person[1].payload.lede).toBe(true);
    expect(person[2].payload.lede).toBe(false);
    expect(atoms.indexOf(person[0])).toBeGreaterThan(
      atoms.map((atom) => atom.kind).lastIndexOf("contents-entry"),
    );
    expect(atoms.indexOf(person.at(-1))).toBeLessThan(
      atoms.findIndex((atom) => atom.kind === "note-banner"),
    );
  });

  it("opens on the printed cover when the programme carries its artwork", () => {
    const atoms = buildNoteFlow({
      programme: { ...programme, cover_artwork: { url: "cover.webp", width: 2, height: 3, alt: "封面" } },
      chapters,
    });

    expect(atoms.at(0).payload.artwork).toEqual({ url: "cover.webp", width: 2, height: 3, alt: "封面" });
  });

  it("closes the book on the sponsor's back cover", () => {
    const atoms = buildNoteFlow({
      programme: { ...programme, back_cover: { url: "back.webp", width: 2, height: 3, alt: "贊助" } },
      chapters,
    });

    expect(atoms.at(-1)).toMatchObject({
      kind: "back-cover",
      payload: { url: "back.webp", width: 2, height: 3, alt: "贊助" },
    });
  });

  it("places full-page sponsor advertisements immediately before the back cover", () => {
    const atoms = buildNoteFlow({
      programme: {
        ...programme,
        sponsor_pages: [{ id: "harp-centre", url: "harp.webp", width: 906, height: 1280, alt: "豎琴中心" }],
        back_cover: { url: "bank.webp", width: 1420, height: 1960, alt: "上海商銀" },
      },
      chapters,
    });

    expect(atoms.slice(-2)).toMatchObject([
      { kind: "sponsor-page", id: "sponsor-page:harp-centre", payload: { url: "harp.webp" } },
      { kind: "back-cover", id: "back-cover", payload: { url: "bank.webp" } },
    ]);
  });

  it("returns the cover and an empty programme list when no chapter is visible", () => {
    const atoms = buildNoteFlow({ programme, chapters: [] });

    expect(kindsOf(atoms)).toEqual(["cover", "contents-heading"]);
  });
});
