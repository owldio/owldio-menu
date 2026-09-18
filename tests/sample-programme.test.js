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

  it("publishes all seven Moonlight Promise programme-note chapters for mobile reading", () => {
    expect(moonlightPromiseProgramme.default_reader_view).toBe("contents");
    expect(moonlightPromiseProgramme.chapters.map(({ title }) => title)).toEqual([
      "格蘭查尼：古典風格的詠嘆調",
      "布拉姆斯：第三號 C 小調鋼琴四重奏，作品 60",
      "獻給月亮——心靈相通的歌聲",
      "伊貝爾：《幕間曲》給小提琴與豎琴",
      "佛瑞：《搖籃》作品 23，第 1 首",
      "德布西／馬修・諾庭改編：《月光》",
      "鄧雨賢／李哲藝改編：《碎心花》",
    ]);

    moonlightPromiseProgramme.chapters.forEach((chapter) => {
      expect(chapter.is_visible).toBe(true);
      expect(chapter.blocks.some(({ type }) => type === "listening-guide")).toBe(true);
      expect(chapter.blocks.some(({ type }) => type === "prose")).toBe(true);
    });

    const publishedText = JSON.stringify(moonlightPromiseProgramme.chapters);
    expect(publishedText).toContain("如何讓豎琴「唱歌」");
    expect(publishedText).toContain("最嚴謹的古典形式");
    expect(publishedText).toContain("整片夜色，只留下了那可以容納一切");
    expect(publishedText.length).toBeGreaterThan(8_000);
  });
});
