import { describe, expect, it } from "vitest";

import { moonlightPromiseChapters } from "../src/data/moonlight-promise-notes.js";

// Score order for the programme and the notes: violins, viola, cello, piano, harp.
const INSTRUMENT_ORDER = ["小提琴 I", "小提琴 II", "小提琴", "中提琴", "大提琴", "鋼琴", "豎琴"];

function rank(instrument) {
  const index = INSTRUMENT_ORDER.indexOf(instrument);
  if (index < 0) throw new Error(`Unranked instrument: ${instrument}`);
  // A lone 小提琴 stands where 小提琴 I would.
  return instrument === "小提琴" ? 0 : index;
}

describe("Moonlight Promise performer order", () => {
  it.each(moonlightPromiseChapters.map((chapter) => [chapter.slug, chapter.performers ?? []]))(
    "lists %s in score order",
    (_slug, performers) => {
      const ranks = performers.map(([instrument]) => rank(instrument));

      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    },
  );

  it("puts the harp after the strings in the full-ensemble works", () => {
    const grandjany = moonlightPromiseChapters.find(
      (chapter) => chapter.slug === "grandjany-aria-in-classic-style",
    );

    expect(grandjany.performers.map(([instrument]) => instrument)).toEqual([
      "小提琴 I",
      "小提琴 II",
      "中提琴",
      "大提琴",
      "豎琴",
    ]);
  });
});
