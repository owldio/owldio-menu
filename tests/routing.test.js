import { describe, expect, it } from "vitest";

import {
  buildProgrammePath,
  buildProgrammeReaderPath,
  parseAppLocation,
} from "../src/domain/routing.js";

describe("parseAppLocation", () => {
  it("maps the root URL to the public shelf", () => {
    expect(parseAppLocation("/", "")).toEqual({ kind: "shelf", view: "shelf" });
  });

  it("maps /admin to the protected administration surface", () => {
    expect(parseAppLocation("/admin", "")).toEqual({ kind: "admin" });
  });

  it("opens a programme from its single public slug", () => {
    expect(parseAppLocation("/sense-and-sensibility", "")).toEqual({
      kind: "programme",
      programmeSlug: "sense-and-sensibility",
      view: "pdf",
    });
  });

  it("marks an old client and programme path for canonical redirection", () => {
    expect(parseAppLocation("/ours/tide-awake", "#contents")).toEqual({
      kind: "programme",
      clientSlug: "ours",
      programmeSlug: "tide-awake",
      legacyPath: true,
      view: "contents",
    });
  });

  it("keeps the former client-prefixed URL readable during migration", () => {
    expect(parseAppLocation("/yuan-chamber/sense-and-sensibility", "")).toEqual({
      kind: "programme",
      clientSlug: "yuan-chamber",
      programmeSlug: "sense-and-sensibility",
      legacyPath: true,
      view: "pdf",
    });
  });

  it("deep-links to a named chapter without losing the programme path", () => {
    expect(parseAppLocation("/ours/tide-awake", "#chapter/directors-note")).toEqual({
      kind: "programme",
      clientSlug: "ours",
      programmeSlug: "tide-awake",
      legacyPath: true,
      view: "chapter",
      chapterSlug: "directors-note",
    });
  });

  it("supports readable Traditional Chinese path segments", () => {
    expect(parseAppLocation("/%E5%AE%A2%E6%88%B6/%E7%AF%80%E7%9B%AE%E5%90%8D%E7%A8%B1", "")).toMatchObject({
      kind: "programme",
      clientSlug: "客戶",
      programmeSlug: "節目名稱",
    });
  });

  it("rejects malformed deep paths", () => {
    expect(parseAppLocation("/ours/tide-awake/extra", "")).toEqual({ kind: "not-found" });
  });
});

describe("buildProgrammePath", () => {
  it("builds one encoded public programme segment", () => {
    expect(buildProgrammePath("潮聲/未眠")).toBe("/%E6%BD%AE%E8%81%B2%2F%E6%9C%AA%E7%9C%A0");
  });

  it("builds the direct reading destination used by programme covers", () => {
    expect(buildProgrammeReaderPath("sense-and-sensibility")).toBe("/sense-and-sensibility");
  });
});
