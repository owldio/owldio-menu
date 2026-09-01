import samplePdfUrl from "../../assets/rational-sensual-programme-sample-v1.pdf?url";
import samplePageOneUrl from "../../assets/rational-sensual-page-1-v1.png?url";
import samplePageTwoUrl from "../../assets/rational-sensual-page-2-v1.png?url";

export const sampleProgramme = {
  id: "sample-tide-awake",
  client_slug: "ours",
  slug: "tide-awake",
  title: "潮聲未眠",
  title_en: "THE TIDE STAYS AWAKE",
  summary: "一座入夜後仍記得潮汐的城市，與三個不願睡去的人。",
  production_type: "原創音樂劇",
  venue: "北城實驗劇場",
  starts_at: "2026-09-18T19:30:00+08:00",
  ends_at: "2026-09-20T21:20:00+08:00",
  duration_minutes: 110,
  visibility: "published",
  cover_theme: "sage",
  pdf_path: null,
  pdf_filename: "rational-sensual-programme-sample-v1.pdf",
  pdf_size_bytes: null,
  published_at: "2026-08-01T00:00:00+08:00",
  chapters: [
    {
      id: "sample-chapter-one",
      position: 1,
      slug: "room-of-the-wakeful",
      title: "第一場　失眠者的房間",
      title_en: "SCENE I · THE ROOM OF THE WAKEFUL",
      page_start: 5,
      is_visible: true,
    },
  ],
};

export const samplePdf = {
  downloadUrl: samplePdfUrl,
  pageImages: [
    {
      src: samplePageOneUrl,
      alt: "使用者提供的《理性與感性》原始節目單第一頁",
    },
    {
      src: samplePageTwoUrl,
      alt: "使用者提供的《理性與感性》原始節目單第二頁",
    },
  ],
};
