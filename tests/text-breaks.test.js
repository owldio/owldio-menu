import { describe, expect, it } from "vitest";

import { clauseBreak, sentenceBreak } from "../src/domain/text-breaks.js";

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
