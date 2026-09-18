import { describe, expect, it } from "vitest";

import { buildNoteFlow } from "../src/domain/notes-flow.js";

const programme = {
  title: "月光下的約定",
  contents_title: "樂曲解說",
  venue: "國家兩廳院演奏廳",
  starts_at: "2026-09-25T19:30:00+08:00",
  intermission_after_position: 2,
};

const chapters = [
  {
    slug: "first-work",
    position: 1,
    title: "第一首",
    title_en: "First Work",
    is_visible: true,
    blocks: [{ type: "prose", paragraphs: ["甲段落。", "乙段落。"] }],
  },
  {
    slug: "second-work",
    position: 2,
    title: "第二首",
    title_en: "Second Work",
    is_visible: true,
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
  it("opens with the cover and closes with the colophon", () => {
    const atoms = buildNoteFlow({ programme, chapters });

    expect(atoms.at(0).kind).toBe("cover");
    expect(atoms.at(1).kind).toBe("contents");
    expect(atoms.at(-1).kind).toBe("colophon");
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
    const contents = atoms.find((atom) => atom.kind === "contents");

    expect(contents.payload.entries).toEqual([
      { kind: "note", number: "01", title: "第一首", titleEn: "First Work", slug: "first-work" },
      { kind: "note", number: "02", title: "第二首", titleEn: "Second Work", slug: "second-work" },
      { kind: "intermission", title: "中場休息" },
      { kind: "note", number: "03", title: "豎琴獨奏", titleEn: null, slug: "harp-solo" },
    ]);
  });

  it("leaves the intermission out when the programme does not declare one", () => {
    const atoms = buildNoteFlow({
      programme: { ...programme, intermission_after_position: null },
      chapters,
    });
    const contents = atoms.find((atom) => atom.kind === "contents");

    expect(contents.payload.entries.every((entry) => entry.kind === "note")).toBe(true);
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

  it("returns cover and colophon even when no chapter is visible", () => {
    const atoms = buildNoteFlow({ programme, chapters: [] });

    expect(kindsOf(atoms)).toEqual(["cover", "contents", "colophon"]);
  });
});
