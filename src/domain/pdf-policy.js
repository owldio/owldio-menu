export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function validatePdfFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  const hasPdfExtension = name.endsWith(".pdf");
  const hasPdfMimeType = type === "application/pdf" || type === "application/x-pdf" || type === "";

  if (!hasPdfExtension || !hasPdfMimeType) {
    return {
      valid: false,
      code: "invalid-type",
      message: "請上傳 PDF 檔案。",
    };
  }

  if (!Number.isFinite(file?.size) || file.size <= 0) {
    return {
      valid: false,
      code: "empty-file",
      message: "這個 PDF 沒有內容，請重新選擇檔案。",
    };
  }

  if (file.size > MAX_PDF_BYTES) {
    return {
      valid: false,
      code: "file-too-large",
      message: "PDF 不得超過 25 MB。",
    };
  }

  return { valid: true };
}

export function buildPdfObjectPath(programmeId) {
  if (!programmeId) {
    throw new TypeError("programmeId is required");
  }

  return `${programmeId}/programme.pdf`;
}
