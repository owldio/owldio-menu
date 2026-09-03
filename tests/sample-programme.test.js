import { describe, expect, it } from "vitest";

import { sampleProgrammes } from "../src/data/sample-programme.js";

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
});
