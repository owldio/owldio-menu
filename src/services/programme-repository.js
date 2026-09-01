import { buildPdfObjectPath, validatePdfFile } from "../domain/pdf-policy.js";

const PROGRAMME_SELECT = `
  id,
  client_slug,
  slug,
  title,
  title_en,
  summary,
  production_type,
  venue,
  starts_at,
  ends_at,
  duration_minutes,
  visibility,
  cover_theme,
  pdf_path,
  pdf_filename,
  pdf_size_bytes,
  published_at,
  created_at,
  updated_at
`;

const PUBLIC_PROGRAMME_SELECT = `${PROGRAMME_SELECT}, programme_chapters (
  id,
  position,
  slug,
  title,
  title_en,
  body,
  page_start,
  is_visible
)`;

function throwOnError(result) {
  if (result.error) {
    throw result.error;
  }

  return result.data;
}

function sortedChapters(programme) {
  if (!programme) {
    return programme;
  }

  return {
    ...programme,
    chapters: [...(programme.programme_chapters || [])].sort((left, right) => left.position - right.position),
  };
}

export class ProgrammeRepository {
  constructor(client) {
    this.client = client;
  }

  async listPublished() {
    const result = await this.client
      .from("programmes")
      .select(PROGRAMME_SELECT)
      .eq("visibility", "published")
      .order("starts_at", { ascending: false });

    return throwOnError(result) || [];
  }

  async getPublicByPath(clientSlug, programmeSlug) {
    const result = await this.client
      .from("programmes")
      .select(PUBLIC_PROGRAMME_SELECT)
      .eq("client_slug", clientSlug)
      .eq("slug", programmeSlug)
      .in("visibility", ["published", "unlisted"])
      .maybeSingle();

    return sortedChapters(throwOnError(result));
  }

  async listForAdmin() {
    const result = await this.client
      .from("programmes")
      .select(PROGRAMME_SELECT)
      .order("updated_at", { ascending: false });

    return throwOnError(result) || [];
  }

  async create(programme, userId) {
    const result = await this.client
      .from("programmes")
      .insert({ ...programme, created_by: userId })
      .select(PROGRAMME_SELECT)
      .single();

    return throwOnError(result);
  }

  async update(id, changes) {
    const result = await this.client
      .from("programmes")
      .update(changes)
      .eq("id", id)
      .select(PROGRAMME_SELECT)
      .single();

    return throwOnError(result);
  }

  async uploadPdf(programmeId, file) {
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      const error = new Error(validation.message);
      error.code = validation.code;
      throw error;
    }

    const path = buildPdfObjectPath(programmeId);
    const uploadResult = await this.client.storage.from("programme-pdfs").upload(path, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: true,
    });
    throwOnError(uploadResult);

    return this.update(programmeId, {
      pdf_path: path,
      pdf_filename: file.name,
      pdf_size_bytes: file.size,
    });
  }

  async createPdfUrl(path, expiresIn = 900) {
    if (!path) {
      return null;
    }

    const result = await this.client.storage.from("programme-pdfs").createSignedUrl(path, expiresIn);
    const data = throwOnError(result);
    return data?.signedUrl || null;
  }
}
