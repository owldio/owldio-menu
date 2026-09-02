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

  it("resolves a client and programme path and keeps the reader chapter", () => {
    expect(parseAppLocation("/ours/tide-awake", "#contents")).toEqual({
      kind: "programme",
      clientSlug: "ours",
      programmeSlug: "tide-awake",
      view: "contents",
    });
  });

  it("opens a clean programme URL directly in the reader", () => {
    expect(parseAppLocation("/yuan-chamber/sense-and-sensibility", "")).toEqual({
      kind: "programme",
      clientSlug: "yuan-chamber",
      programmeSlug: "sense-and-sensibility",
      view: "pdf",
    });
  });

  it("deep-links to a named chapter without losing the programme path", () => {
    expect(parseAppLocation("/ours/tide-awake", "#chapter/directors-note")).toEqual({
      kind: "programme",
      clientSlug: "ours",
      programmeSlug: "tide-awake",
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
  it("encodes each path segment", () => {
    expect(buildProgrammePath("故事 工廠", "潮聲/未眠")).toBe(
      "/%E6%95%85%E4%BA%8B%20%E5%B7%A5%E5%BB%A0/%E6%BD%AE%E8%81%B2%2F%E6%9C%AA%E7%9C%A0",
    );
  });

  it("builds the direct reading destination used by programme covers", () => {
    expect(buildProgrammeReaderPath("yuan-chamber", "sense-and-sensibility")).toBe(
      "/yuan-chamber/sense-and-sensibility",
    );
  });
});
