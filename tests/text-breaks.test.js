import { describe, expect, it } from "vitest";

import { chooseCut, clauseBreak, sentenceBreak } from "../src/domain/text-breaks.js";

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
