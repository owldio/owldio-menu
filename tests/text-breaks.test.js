import { describe, expect, it } from "vitest";

import {
  chooseCut,
  clauseBreak,
  leadPhraseLength,
  lineBreak,
  orphanGuardStart,
  sentenceBreak,
  setsJustified,
} from "../src/domain/text-breaks.js";

describe("orphanGuardStart", () => {
  it("keeps the last two characters and the closing full stop together", () => {
    const text = "清新悅耳的旋律，飽含對春天的期盼和對他人溫柔的思念。";

    expect(text.slice(orphanGuardStart(text))).toBe("思念。");
  });

  it("carries every closing mark along with the last two characters", () => {
    const text = "這一段話最後以引號收尾，作為測試用的句子「願心靈相連。」";

    expect(text.slice(orphanGuardStart(text))).toBe("相連。」");
  });

  it("carries a closing mark that falls between the last two characters", () => {
    const text = "創作了許多時代巨作，如《月夜愁》、《雨夜花》和《碎心花》等。";

    expect(text.slice(orphanGuardStart(text))).toBe("花》等。");
  });

  it("guards the last two characters of a paragraph that ends without punctuation", () => {
    const text = "這是一段沒有句號結尾的中文段落文字";

    expect(text.slice(orphanGuardStart(text))).toBe("文字");
  });

  it("leaves a short paragraph alone, since it cannot strand a character", () => {
    expect(orphanGuardStart("短句。")).toBe(-1);
  });

  it("leaves a paragraph that ends on a Latin word or a number to the browser", () => {
    expect(orphanGuardStart("這首歌的英文名稱是 Furusato (Hometown)")).toBe(-1);
    expect(orphanGuardStart("這首作品最後於西元年完成並出版於 1875")).toBe(-1);
  });
});

describe("setsJustified", () => {
  it("justifies a paragraph of Chinese alone", () => {
    expect(setsJustified("臺灣代表性歌曲，歌頌少女被春風輕拂時的感受。")).toBe(true);
    expect(setsJustified("於1930 年代日治時期發表。")).toBe(true);
  });

  it("leaves a paragraph with Latin words ragged, so no line is pulled apart", () => {
    expect(setsJustified("布拉姆斯（Johannes Brahms，1833－1897）對這種編制尤其具有獨特的掌握能力。")).toBe(false);
  });
});

describe("leadPhraseLength", () => {
  function leadOf(text) {
    return text.slice(0, leadPhraseLength(text));
  }

  it("ends a lede's opening phrase at its first comma", () => {
    expect(leadOf("我們將以日本櫻花木製成的小豎琴，演奏臺灣和日本兩地都備受珍視的歌曲。"))
      .toBe("我們將以日本櫻花木製成的小豎琴");
  });

  it("ends it after a name's gloss, whatever commas the gloss holds", () => {
    expect(leadOf("格蘭查尼（Marcel Grandjany，1891－1975）出生於巴黎，是 20 世紀法國重要的豎琴家。"))
      .toBe("格蘭查尼（Marcel Grandjany，1891－1975）");
  });

  it("reads through a comma inside a title", () => {
    expect(leadOf("《春天，來了》是一首歌，後來傳遍全島。")).toBe("《春天，來了》是一首歌");
  });

  it("does not end the phrase at an enumeration comma", () => {
    expect(leadOf("鋼琴、小提琴與大提琴組成的三重奏，是室內樂的常見編制。"))
      .toBe("鋼琴、小提琴與大提琴組成的三重奏");
  });

  it("counts Latin letters as half a character", () => {
    expect(leadOf("作曲家（Wolfgang Amadeus Mozart and Johann Sebastian Bach）的作品。"))
      .toBe("作曲家（Wolfgang Amadeus Mozart and Johann Sebastian Bach）");
  });

  it("sets no phrase apart when none ends within two lines", () => {
    expect(leadPhraseLength(`${"長".repeat(45)}，後文。`)).toBe(0);
    expect(leadPhraseLength(
      "A lede written in English has no Chinese punctuation to end its first phrase, so none is set apart.",
    )).toBe(0);
  });
});

describe("chooseCut", () => {
  const LINE = 30;
  const room = { available: 300, lineHeight: LINE, minimumHead: LINE * 2 };

  function candidates({ sentence, clause, line }) {
    return [
      { kind: "sentence", cut: 40, height: sentence },
      { kind: "clause", cut: 52, height: clause },
      { kind: "line", cut: 60, height: line },
    ];
  }

  it("ends the page on a full sentence when that leaves no more than two lines empty", () => {
    const chosen = chooseCut(candidates({ sentence: 300 - LINE * 2, clause: 300 - LINE, line: 300 }), room);

    expect(chosen.kind).toBe("sentence");
  });

  it("passes over a sentence that would open a hole, for a clause near the foot", () => {
    const chosen = chooseCut(candidates({ sentence: 300 - LINE * 3, clause: 300 - LINE, line: 300 }), room);

    expect(chosen.kind).toBe("clause");
  });

  it("runs to the end of the line when no sentence or clause lands close enough", () => {
    const chosen = chooseCut(candidates({ sentence: 300 - LINE * 3, clause: 300 - LINE * 2, line: 300 - 4 }), room);

    expect(chosen.kind).toBe("line");
  });

  it("never leaves a head shorter than the minimum at the foot of a page", () => {
    const tight = { ...room, available: LINE * 2.5 };
    const chosen = chooseCut(candidates({ sentence: LINE, clause: LINE * 1.5, line: LINE * 2.5 }), tight);

    expect(chosen.kind).toBe("line");
  });

  it("finds nothing when every head would overrun the room", () => {
    expect(chooseCut(candidates({ sentence: 330, clause: 330, line: 330 }), room)).toBeNull();
  });
});

describe("sentenceBreak", () => {
  it("cuts after the last full stop that still fits", () => {
    expect(sentenceBreak("甲乙。丙丁。戊己", 7)).toBe(6);
  });

  it("looks further back when the nearest sentence runs past the limit", () => {
    expect(sentenceBreak("甲乙。丙丁戊己", 6)).toBe(3);
  });

  it("keeps a closing quote with the sentence it ends", () => {
    expect(sentenceBreak("他說「好。」然後", 7)).toBe(6);
  });

  it("does not leave a closing quote stranded when it would not fit", () => {
    expect(sentenceBreak("甲。他說「好。」然後", 6)).toBe(2);
  });

  it("treats question and exclamation marks as sentence ends", () => {
    expect(sentenceBreak("是嗎？是的！然後", 7)).toBe(6);
  });

  it("finds nothing in text without a sentence end", () => {
    expect(sentenceBreak("甲乙丙丁戊己", 6)).toBe(0);
  });
});

describe("clauseBreak", () => {
  it("falls back to the last comma or enumeration mark", () => {
    expect(clauseBreak("甲乙，丙丁、戊己", 7)).toBe(6);
  });

  it("finds nothing in an unbroken run", () => {
    expect(clauseBreak("甲乙丙丁戊己", 6)).toBe(0);
  });
});

describe("lineBreak", () => {
  it("uses the full measured line instead of jumping back to punctuation", () => {
    expect(lineBreak("甲乙。丙丁，戊己", 7)).toBe(7);
  });

  it("keeps a Latin word intact when the measured edge lands inside it", () => {
    expect(lineBreak("前文 Grandjany 後文", 10)).toBe(3);
  });
});
