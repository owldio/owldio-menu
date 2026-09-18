import { describe, expect, it } from "vitest";

import {
  formatDate,
  programmeDateLabel,
  programmeDateParts,
  programmeTimeLabel,
} from "../src/domain/datetime.js";

describe("formatDate", () => {
  it("formats in Taipei time regardless of the offset written in the source", () => {
    expect(formatDate("2026-09-25T11:30:00Z", { year: "numeric", month: "2-digit", day: "2-digit" }))
      .toBe("2026/09/25");
  });

  it("falls back to a placeholder for missing or unparsable values", () => {
    const options = { year: "numeric", month: "2-digit", day: "2-digit" };

    expect(formatDate(null, options)).toBe("待公告");
    expect(formatDate("", options)).toBe("待公告");
    expect(formatDate("not a date", options)).toBe("待公告");
  });
});

describe("programmeDateLabel", () => {
  it("shows a single date for a one-night performance", () => {
    expect(programmeDateLabel({ starts_at: "2026-09-25T19:30:00+08:00" })).toBe("2026/09/25");
  });

  it("shows a range when the run has an end date", () => {
    expect(
      programmeDateLabel({
        starts_at: "2026-09-25T19:30:00+08:00",
        ends_at: "2026-09-27T19:30:00+08:00",
      }),
    ).toBe("2026/09/25—09/27");
  });
});

describe("programmeTimeLabel", () => {
  it("shows the weekday and a 24-hour curtain time", () => {
    expect(programmeTimeLabel({ starts_at: "2026-09-25T19:30:00+08:00" })).toBe("週五 19:30");
  });

  it("falls back to a placeholder when no start time is known", () => {
    expect(programmeTimeLabel({ starts_at: null })).toBe("待公告");
  });
});

describe("programmeDateParts", () => {
  it("splits a curtain time into the pieces a poster sets separately", () => {
    expect(programmeDateParts({ starts_at: "2026-09-25T19:30:00+08:00" })).toEqual({
      year: "2026",
      monthDay: "9.25",
      weekday: "五",
      time: "19:30",
    });
  });

  it("reads the parts in Taipei time", () => {
    expect(programmeDateParts({ starts_at: "2026-09-25T16:00:00Z" })).toMatchObject({
      monthDay: "9.26",
      weekday: "六",
      time: "00:00",
    });
  });

  it("returns nothing when the date is unknown", () => {
    expect(programmeDateParts({ starts_at: null })).toBeNull();
    expect(programmeDateParts({ starts_at: "not a date" })).toBeNull();
  });
});
