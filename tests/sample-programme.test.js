import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { moonlightPromiseProgramme, sampleProgrammes } from "../src/data/sample-programme.js";

describe("sample programme catalogue", () => {
  it("reads Moonlight Promise in the editorial sequence specified for its tri-fold", () => {
    const programme = sampleProgrammes.find(({ slug }) => slug === "moonlight-promise");

    expect(programme?.pdf_source).toMatchObject({
      foldMode: "tri-fold",
      panelLabels: [
        "封面",
        "曲目順序",
        "彩愛玲",
        "音樂家介紹（小提琴一、二／中提琴）",
        "音樂家介紹（大提琴／鋼琴）",
        "贊助資訊",
      ],
      readingOrder: [
        { pageNumber: 1, panelIndex: 0 },
        { pageNumber: 2, panelIndex: 2 },
        { pageNumber: 1, panelIndex: 2 },
        { pageNumber: 2, panelIndex: 1 },
        { pageNumber: 2, panelIndex: 0 },
        { pageNumber: 1, panelIndex: 1 },
      ],
      panelBoundaries: {
        1: [0, 0.337383, 0.676974, 1],
      },
      foldLayout: {
        insidePanelOrder: [2, 1, 0],
        closingPanelIndex: 2,
        backCoverPanelIndex: 1,
      },
    });
  });

  it("publishes the seven Moonlight Promise notes as a paged book", () => {
    expect(moonlightPromiseProgramme).toMatchObject({
      default_reader_view: "notes-book",
      reader_layout: "notes-book",
      show_pdf_in_contents: false,
      intermission_after_position: 2,
    });
    expect(moonlightPromiseProgramme.chapters.map(({ title }) => title)).toEqual([
      "格蘭查尼：古典風格的詠嘆調",
      "布拉姆斯：第三號 C 小調鋼琴四重奏，作品 60",
      "豎琴獨奏：獻給月亮－心靈相通的歌聲",
      "伊貝爾：《幕間曲》給小提琴與豎琴",
      "佛瑞：《搖籃》作品23，第 1 首",
      "德布西／馬修諾庭 改編：《月光》",
      "鄧雨賢∕李哲藝 改編：《碎心花》",
    ]);

    moonlightPromiseProgramme.chapters.forEach((chapter) => {
      expect(chapter.is_visible).toBe(true);
      expect(chapter.reading_minutes).toBeUndefined();
      expect(chapter.blocks.every(({ type }) => ["prose", "programme-list"].includes(type))).toBe(true);
    });

    const publishedText = JSON.stringify(moonlightPromiseProgramme.chapters);
    expect(publishedText).toContain("如何讓豎琴「唱歌」");
    expect(publishedText).toContain("最嚴謹的古典形式");
    expect(publishedText).toContain("整片夜色，只留下了那可以容納一切");
    expect(publishedText).toContain("高野達幸");
    expect(publishedText).toContain("飽受對春天的期盼");
    expect(publishedText).toContain("一這首著名的日本歌曲");
    expect(publishedText).toContain("法國作曲家加佛瑞");
    expect(publishedText).toContain("9∕8 拍、行版");
    expect(publishedText).toContain("Yu-Hsain Tung /arr. Che-Yi Lee");
    expect(publishedText).toContain("曲調特色：本曲採用四拍子");
    expect(publishedText).not.toContain("聆聽重點");
    expect(publishedText).not.toContain("先聽這三件事");
    expect(publishedText.length).toBeGreaterThan(8_000);

    const sourceCopy = moonlightPromiseProgramme.chapters.map(({
      title,
      title_en: titleEn,
      author,
      blocks,
    }) => ({
      title,
      title_en: titleEn,
      author,
      blocks: blocks.map((block) => block.type === "prose"
        ? { type: block.type, paragraphs: block.paragraphs }
        : {
          type: block.type,
          items: block.items.map(([, itemTitle, detail]) => [itemTitle, detail]),
        }),
    }));
    const sourceCopyHash = createHash("sha256")
      .update(JSON.stringify(sourceCopy))
      .digest("hex");
    expect(sourceCopyHash).toBe("f080212a75afc1eec01e7fefd33084240cc927246079a818ecbb25b20b5861f9");
  });
});
