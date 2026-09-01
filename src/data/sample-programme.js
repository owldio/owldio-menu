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
      kind: "essay",
      eyebrow: "SCENE I",
      title: "第一場　失眠者的房間",
      title_en: "SCENE I · THE ROOM OF THE WAKEFUL",
      page_start: 5,
      is_visible: true,
      blocks: [
        {
          type: "lede",
          text: "凌晨兩點十七分，城市的潮聲穿過沒有關緊的窗。黎安坐在地板上，把同一段旋律反覆彈了十九次。",
        },
        {
          type: "prose",
          paragraphs: [
            "《潮聲未眠》從一個很小的問題開始：如果一座城市不再做夢，還有誰會替它記得曾經失去的人？我們把排練場分成三條看不見的岸線，演員每一次跨越，都會讓樂句產生一點偏移。",
            "第一場沒有完整的歌。鋼琴、呼吸與鞋底摩擦地板的聲音先建立節奏，直到角色願意說出名字，旋律才第一次被聽見。",
          ],
        },
        {
          type: "score",
          number: "I.",
          label: "OPENING NUMBER",
          title: "〈潮線以北〉",
          details: [
            ["Tempo", "Adagio, ♩ = 54"],
            ["Players", "Piano · Viola · Voice"],
            ["Duration", "06′ 40″"],
          ],
        },
        {
          type: "quote",
          text: "我們不是為了醒著而醒著。只是海還沒有把最後一句話說完。",
          cite: "黎安，第一場",
        },
      ],
    },
    {
      id: "sample-chapter-two",
      position: 2,
      slug: "music-and-scenes",
      kind: "programme",
      eyebrow: "MUSIC & SCENES",
      title: "曲目與場次",
      title_en: "MUSIC & SCENES",
      page_start: 7,
      is_visible: true,
      blocks: [
        {
          type: "lede",
          text: "七段音樂像七次潮汐：不是把故事切開，而是讓觀眾知道此刻站在哪一條岸線上。",
        },
        {
          type: "programme-list",
          items: [
            ["01", "潮線以北", "鋼琴、低音提琴與人聲", "06′40″"],
            ["02", "沒有寄出的海圖", "黎安／獨唱", "08′15″"],
            ["03", "第三盞路燈", "三重唱", "05′30″"],
            ["04", "城市睡去以前", "器樂間奏", "04′20″"],
            ["05", "退潮的人", "岑雨／獨唱", "07′10″"],
            ["06", "把名字留在岸上", "全體", "09′05″"],
            ["07", "天亮仍有浪", "終曲", "06′55″"],
          ],
        },
      ],
    },
    {
      id: "sample-chapter-three",
      position: 3,
      slug: "directors-note",
      kind: "letter",
      eyebrow: "DIRECTOR'S NOTE",
      title: "導演的話　關於沒有睡著的海",
      title_en: "A NOTE ON THE SLEEPLESS SEA",
      page_start: 9,
      is_visible: true,
      blocks: [
        { type: "dateline", text: "臺北，2026 年初秋" },
        {
          type: "lede",
          text: "劇場裡的夜晚很奇怪。燈一暗，我們反而開始看見白天不敢承認的事。",
        },
        {
          type: "prose",
          paragraphs: [
            "這齣戲沒有要解釋失眠，也不想把離開說成一件漂亮的事。我們只是陪三個人坐到天亮，聽他們如何把一句沒有說完的話交給音樂。",
            "謝謝每一位在排練場裡容許沉默發生的人。也謝謝今晚坐在觀眾席裡的你，願意把自己的夜晚借給我們。",
          ],
        },
        { type: "signature", name: "周棲", role: "導演暨共同編劇" },
      ],
    },
    {
      id: "sample-chapter-four",
      position: 4,
      slug: "cast-and-musicians",
      kind: "people",
      eyebrow: "CAST & MUSICIANS",
      title: "演員與樂手",
      title_en: "CAST & MUSICIANS",
      page_start: 11,
      is_visible: true,
      blocks: [
        {
          type: "people-list",
          items: [
            ["黎安", "林以森", "在城市檔案室值夜班，把旋律寫在借閱單背面。"],
            ["岑雨", "陳穗", "聲音採集者，記得每一場雨卻忘了自己的生日。"],
            ["阿默", "高未明", "末班渡船的駕駛，也是唯一聽得見退潮的人。"],
            ["鋼琴", "羅以安", "現場演奏／音樂共同創作。"],
            ["中提琴", "徐方庭", "現場演奏。"],
            ["低音提琴", "黃知遠", "現場演奏。"],
          ],
        },
      ],
    },
    {
      id: "sample-chapter-five",
      position: 5,
      slug: "creative-team",
      kind: "credits",
      eyebrow: "CREATIVE & PRODUCTION TEAM",
      title: "幕後製作團隊",
      title_en: "CREATIVE & PRODUCTION TEAM",
      page_start: 13,
      is_visible: true,
      blocks: [
        {
          type: "credits",
          groups: [
            {
              title: "創作",
              items: [["編劇", "周棲、許白"], ["導演", "周棲"], ["作曲", "羅以安"], ["編舞", "夏維"]],
            },
            {
              title: "舞台",
              items: [["舞台設計", "王重山"], ["燈光設計", "葉霧"], ["服裝設計", "杜嘉"], ["音響設計", "江泊"]],
            },
            {
              title: "製作",
              items: [["製作人", "溫晴"], ["舞台監督", "張珞"], ["執行製作", "陳亭"], ["平面設計", "OWLDIO"]],
            },
          ],
        },
      ],
    },
    {
      id: "sample-chapter-six",
      position: 6,
      slug: "visitor-information",
      kind: "visitor",
      eyebrow: "VISITOR INFORMATION",
      title: "演出資訊與場館須知",
      title_en: "VISITOR INFORMATION",
      page_start: 15,
      is_visible: true,
      blocks: [
        {
          type: "info-grid",
          items: [
            ["演出長度", "約 110 分鐘，無中場休息"],
            ["建議年齡", "建議 12 歲以上觀眾入場"],
            ["遲到入場", "依現場工作人員指示，於適當段落入場"],
            ["字幕", "中文演出；部分場次提供英文字幕"],
          ],
        },
        {
          type: "notice",
          title: "演出提醒",
          text: "演出使用煙霧、瞬間強光與較大音量。觀眾席內請關閉會發光或發出聲響的裝置。",
        },
        {
          type: "notice",
          title: "節目冊保存",
          text: "本頁於演後仍會保留。原始 PDF 可下載收藏；最新演出異動以現場公告為準。",
        },
      ],
    },
  ],
};

function demoProgramme(overrides) {
  return {
    ...sampleProgramme,
    ...overrides,
    pdf_filename: null,
    chapters: sampleProgramme.chapters,
  };
}

export const sampleProgrammes = [
  sampleProgramme,
  demoProgramme({
    id: "sample-before-the-migrating-birds-stall",
    client_slug: "field-notes",
    slug: "before-the-migrating-birds-stall",
    title: "候鳥失速之前",
    title_en: "BEFORE THE MIGRATING BIRDS STALL",
    summary: "三名舞者沿著一條不斷偏移的航線，練習離開，也練習折返。",
    production_type: "當代舞",
    venue: "水源劇場",
    starts_at: "2026-10-09T19:30:00+08:00",
    ends_at: "2026-10-11T21:00:00+08:00",
    duration_minutes: 75,
    cover_theme: "cobalt",
  }),
  demoProgramme({
    id: "sample-third-star-in-the-darkroom",
    client_slug: "room-zero",
    slug: "third-star-in-the-darkroom",
    title: "暗房裡的第三顆星",
    title_en: "THE THIRD STAR IN THE DARKROOM",
    summary: "一間照相館、一捲沒有主人的底片，以及每晚準時出現的陌生客人。",
    production_type: "實驗戲劇",
    venue: "牯嶺街小劇場",
    starts_at: "2026-11-06T19:30:00+08:00",
    ends_at: "2026-11-08T21:10:00+08:00",
    duration_minutes: 95,
    cover_theme: "oxide",
  }),
  demoProgramme({
    id: "sample-voices-behind-the-wall",
    client_slug: "north-window",
    slug: "voices-behind-the-wall",
    title: "聲音從牆後來",
    title_en: "VOICES FROM BEHIND THE WALL",
    summary: "四件樂器與一棟老屋互相聆聽，讓被封住的回聲重新有了出口。",
    production_type: "室內樂劇場",
    venue: "國家兩廳院實驗劇場",
    starts_at: "2026-12-04T19:30:00+08:00",
    ends_at: "2026-12-05T21:00:00+08:00",
    duration_minutes: 80,
    cover_theme: "ultramarine",
  }),
  demoProgramme({
    id: "sample-island-moving-slowly",
    client_slug: "island-lab",
    slug: "island-moving-slowly",
    title: "島嶼緩慢移動",
    title_en: "AN ISLAND MOVES SLOWLY",
    summary: "聲音、光與步行組成一場沒有固定座位的島嶼觀測。",
    production_type: "跨域現場",
    venue: "臺北表演藝術中心藍盒子",
    starts_at: "2027-01-15T19:00:00+08:00",
    ends_at: "2027-01-17T20:30:00+08:00",
    duration_minutes: 90,
    cover_theme: "citron",
  }),
];

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
