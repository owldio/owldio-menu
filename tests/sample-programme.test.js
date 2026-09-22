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
        "彩 愛玲",
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

  it("credits every funder of Moonlight Promise as a sponsor, with no co-organisers", () => {
    expect(moonlightPromiseProgramme.presenter).toBe("中原風雅頌室內樂集樂團");
    expect(moonlightPromiseProgramme.sponsors).toEqual([
      "臺北市政府文化局",
      "上海商業儲蓄銀行文教基金會",
      "台灣豎琴中心",
    ]);
    expect(moonlightPromiseProgramme.supporters ?? []).toEqual([]);
  });

  it("keeps the Japanese harpist's spaced stage name across the programme", () => {
    expect(moonlightPromiseProgramme.people[0]).toMatchObject({
      slug: "sai-ai-ling",
      role: "豎琴",
      name: "彩 愛玲",
      name_en: "Sai Ai Ling",
    });
    expect(JSON.stringify(moonlightPromiseProgramme)).not.toContain("彩愛玲");
  });

  it("orders performers as harp, violins and viola, then cello and piano", () => {
    expect(moonlightPromiseProgramme.people.map(({ role, name }) => [role, name])).toEqual([
      ["豎琴", "彩 愛玲"],
      ["小提琴", "李季"],
      ["小提琴", "詹青青"],
      ["中提琴", "楊瑞瑟"],
      ["大提琴", "黃韻宇"],
      ["鋼琴", "陳文婉"],
    ]);
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
      "豎琴獨奏：獻給月亮——心靈相通的歌聲",
      "伊貝爾：《幕間曲》給小提琴與豎琴",
      "佛瑞：《搖籃》作品23，第 1 首",
      "德布西／馬修諾庭 改編：《月光》",
      "鄧雨賢／李哲藝 改編：《碎心花》",
    ]);

    moonlightPromiseProgramme.chapters.forEach((chapter) => {
      expect(chapter.is_visible).toBe(true);
      expect(chapter.reading_minutes).toBeUndefined();
      expect(chapter.blocks.every(({ type }) => ["prose", "programme-list", "song-groups"].includes(type))).toBe(true);
    });

    const publishedText = JSON.stringify(moonlightPromiseProgramme.chapters);
    expect(publishedText).toContain("如何讓豎琴「唱歌」");
    expect(publishedText).toContain("《故鄉》");
    expect(publishedText).not.toContain("《故郷》");
    expect(publishedText).toContain("最嚴謹的古典形式");
    expect(publishedText).toContain("整片夜色，只留下了那可以容納一切");
    expect(publishedText).toContain('"composer":"岡野貞一"');
    expect(publishedText).toContain('"title":"《朧月夜》","title_en":"Oborozukiyo (Misty Moonlit Night)","lyricist":"高野辰之"');
    expect(publishedText).not.toContain("高野達幸");
    expect(publishedText).toContain("飽含對春天的期盼");
    expect(publishedText).not.toContain("飽受");
    expect(publishedText).toContain('"title_en":"Furusato (Hometown)","lyricist":"高野辰之","text":"這首著名的日本歌曲');
    expect(publishedText).not.toContain("一這首");
    expect(publishedText).toContain("法國作曲家佛瑞（Gabriel Fauré");
    expect(publishedText).not.toContain("加佛瑞");
    expect(publishedText).toContain("9∕8 拍、行版");
    // Names and formats follow the printed tri-fold: Teng, and "(arr. …)".
    expect(publishedText).toContain("Yu-Hsien Teng (arr. Che-Yi Lee)");
    expect(publishedText).toContain("Claude Debussy (arr. Matthew Naughtin)");
    expect(publishedText).toContain("Jacques Ibert: Entr'acte for Violin and Harp");
    expect(publishedText).not.toContain("Entr’acte");
    expect(moonlightPromiseProgramme.chapters.map(({ title_en: titleEn }) => titleEn)).toEqual([
      "Marcel Grandjany: Aria in Classic Style",
      "Johannes Brahms: Piano Quartet No. 3 in C Minor, Op. 60",
      null,
      "Jacques Ibert: Entr'acte for Violin and Harp",
      "Gabriel Fauré: Les Berceaux, Op. 23, No. 1",
      "Claude Debussy (arr. Matthew Naughtin): Clair de Lune",
      "Yu-Hsien Teng (arr. Che-Yi Lee): Broken Hearted Flower",
    ]);
    expect(moonlightPromiseProgramme.chapters[6].running_head).toBe("title");
    expect(publishedText).toContain("鄧雨賢／李哲藝 改編");
    expect(publishedText).not.toContain("Tung");
    expect(publishedText).not.toContain("∕李哲藝");

    expect(moonlightPromiseProgramme.chapters[1].movements).toEqual([
      ["I.", "不太快的快板", "Allegro non troppo"],
      ["II.", "詼諧曲：快板", "Scherzo: Allegro"],
      ["III.", "行板", "Andante"],
      ["IV.", "終曲：從容地快板", "Finale: Allegro comodo"],
    ]);
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
      blocks: blocks.map((block) => {
        if (block.type === "prose") return { type: block.type, paragraphs: block.paragraphs };
        if (block.type === "song-groups") return { type: block.type, groups: block.groups };
        return {
          type: block.type,
          items: block.items.map(([, itemTitle, detail]) => [itemTitle, detail]),
        };
      }),
    }));
    const sourceCopyHash = createHash("sha256")
      .update(JSON.stringify(sourceCopy))
      .digest("hex");
    // The printed copy, with the corrections the presenter asked for: 加佛瑞 → 佛瑞,
    // 高野達幸 → 高野辰之 as the lyricist of 《朧月夜》, 飽受 → 飽含 in 《望春風》,
    // a stray 一 before 這首 in 《故鄉》, Yu-Hsain → Yu-Hsien in 《碎心花》, and the
    // names and formats of the printed tri-fold: Teng, "(arr. …)" and ／; plus
    // the presenter's requested spacing for the Japanese harpist, 彩 愛玲;
    // plus the corrected em dash, ASCII apostrophe, and Fauré spelling;
    // plus the harp-solo songs regrouped by composer, their copy unchanged.
    expect(sourceCopyHash).toBe("72083116f30d1018c715bb7787ec52ebef6cb32fe7be5aaffff147e3e9cbcdb9");
  });
});
