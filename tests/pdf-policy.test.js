import { describe, expect, it } from "vitest";

import { buildPdfObjectPath, validatePdfFile } from "../src/domain/pdf-policy.js";

describe("validatePdfFile", () => {
  it("accepts a PDF within the 25 MiB limit", () => {
    expect(
      validatePdfFile({ name: "programme.pdf", type: "application/pdf", size: 8 * 1024 * 1024 }),
    ).toEqual({ valid: true });
  });

  it("rejects files that are not PDFs", () => {
    expect(validatePdfFile({ name: "programme.jpg", type: "image/jpeg", size: 1024 })).toEqual({
      valid: false,
      code: "invalid-type",
      message: "請上傳 PDF 檔案。",
    });
  });

  it("rejects PDFs larger than 25 MiB", () => {
    expect(
      validatePdfFile({ name: "programme.pdf", type: "application/pdf", size: 25 * 1024 * 1024 + 1 }),
    ).toMatchObject({ valid: false, code: "file-too-large" });
  });
});

describe("buildPdfObjectPath", () => {
  it("uses one replaceable object per programme", () => {
    expect(buildPdfObjectPath("b72a9db0-54ea-40f4-a169-2f356f2618ae")).toBe(
      "b72a9db0-54ea-40f4-a169-2f356f2618ae/programme.pdf",
    );
  });
});
