# 《月光下的約定》樂曲解說：翻頁電子書

- 日期：2026-09-18
- 路由：`/moonlight-promise`（已印在三折頁 QR 上，不得變更）
- 取代：現行 `reader_layout: "programme-notes"` 長捲軸

## 背景

印刷三折頁節目單交給現場觀眾，但版面裝不下樂曲解說，只在曲目下方放了一個 QR code。掃碼進來的 `/moonlight-promise` 就是節目單裝不下的那幾面。

目前這頁把七篇解說堆成一條長捲軸。它讀起來像一份貼上網的文件，不像節目單的延續。

`/sense-and-sensibility` 已經有一套沉浸式翻頁閱讀器（`src/publication-pdf.js`），但它渲染的是 PDF canvas。樂曲解說沒有對應的印刷檔，內容也可能在演出前修訂。

## 目標

1. 閱讀體驗是一本書：跨頁、翻頁、縮圖、縮放、全螢幕，與 `/sense-and-sensibility` 同一套語彙。
2. 視覺是印刷節目單的延續：同一片深藍夜空、同一條金線、同一把豎琴。
3. 版面密度等同印刷品，不是放大的網頁文字。
4. 文字保持為活的 HTML：可選取、可搜尋、可朗讀，改稿只改資料。

## 非目標

- 不收演奏者介紹（已印在三折頁上）。
- 不做字級切換鈕；密度由縮放負責。
- 不改動 `/sense-and-sensibility` 的 PDF 閱讀器。
- 不新增後台編輯介面；內容仍由 `src/data/` 供應。

## 內容盤點

實際字數 8,528（與使用者提供的 `2026.09.25樂曲解說(09.09).pdf` 逐字比對相同，無須重新匯入）：

| # | 曲目 | 字數 | 特殊區塊 |
| --- | --- | --- | --- |
| 01 | 格蘭查尼：古典風格的詠嘆調 | 2,527 | — |
| 02 | 布拉姆斯：第三號 C 小調鋼琴四重奏，作品 60 | 2,234 | — |
| 03 | 豎琴獨奏：獻給月亮－心靈相通的歌聲 | 771 | `programme-list`（五首曲目卡） |
| 04 | 伊貝爾：《幕間曲》給小提琴與豎琴 | 1,561 | — |
| 05 | 佛瑞：《搖籃》作品 23，第 1 首 | 515 | 單一長段落 |
| 06 | 德布西／馬修諾庭 改編：《月光》 | 712 | — |
| 07 | 鄧雨賢／李哲藝 改編：《碎心花》 | 208 | — |

## 版面幾何

單一固定版面，所有裝置共用同一份分頁結果。

| 參數 | 值 |
| --- | --- |
| 頁面邏輯尺寸 | 800 × 1131 px（1 : √2） |
| 左右留白 | 80 px |
| 上留白 | 92 px |
| 下留白 | 84 px（含頁腳） |
| 文字欄寬 | 640 px |
| 內文字級 | 16 px |
| 行高 | 1.9（行盒 30.4 px） |
| 每行字數 | 約 38 字 |
| 每頁行數 | 約 32 行 |
| 每頁容量 | 約 1,250 字 |

預估總頁數約 13 頁（桌機 7 個跨頁），與 6 頁 A4 原稿相當。實際頁數由分頁引擎決定，不寫死。

## 頁面地圖

| 頁 | 類型 | 內容 |
| --- | --- | --- |
| 01 | `cover` | 月暈、豎琴弦、櫻花；「樂曲解說 / PROGRAMME NOTES」；日期、場地 |
| 02 | `contents` | 七首曲目編號清單，含中場休息分隔；點擊跳至該曲 |
| 03– | `note` | 七首曲，各自「標題橫幅 → 內文」，續頁只有內文與頁腳 |
| 末 | `colophon` | 演出資訊、主辦協辦、回節目單封面 |

每首曲的首頁頂端是金色標題橫幅：編號、中文曲名、英文曲名、編制。不做獨立扉頁 —— 碎心花只有 208 字，扉頁加一頁內文會留下大片空白，也多一次無意義的翻頁。這與印刷節目單中樂曲解說的既有做法一致。

## 分頁引擎

拆成兩層，量測與排版分離，讓排版邏輯可以在沒有 DOM 的情況下測試。

### `src/domain/notes-flow.js`（純函式）

```
buildNoteFlow(chapters) -> Atom[]
```

把章節資料攤平成有序的原子串。`Atom` 形狀：

```
{ kind: "cover" | "contents" | "note-banner" | "paragraph" | "work-card" | "colophon",
  noteSlug: string | null,
  noteIndex: number | null,
  splittable: boolean,
  payload: object }
```

規則：

- `cover`、`contents`、`colophon`、`work-card`：`splittable: false`
- `note-banner`：`splittable: false`
- `paragraph`：`splittable: true`

### `src/domain/notes-pagination.js`（純函式，注入量測器）

```
packAtoms(atoms, { capacity, measure, splitParagraph }) -> Page[]
```

`measure(atom) -> number`（高度 px）與 `splitParagraph(atom, availableHeight) -> [head, tail]` 由呼叫端注入。測試時注入假量測器。

排版規則：

1. 整頁原子（`cover`、`contents`、`colophon`）獨佔一頁。
2. `note-banner` 後面至少要跟兩行內文；否則橫幅推到下一頁。
3. `paragraph` 可跨頁，但兩側各至少保留兩行（避免孤行寡行）。當前頁剩餘高度不足兩行時，不切割，整段推到下一頁。
4. `work-card` 不可分割；放不下就整張推到下一頁。
5. 頁碼、頁腳不佔用容量計算（在留白區內）。
6. 單一原子高度超過整頁容量時（理論上只可能是超長段落），強制切割並允許最後一段溢出，不得丟棄內容。

`Page` 形狀：`{ index, kind, noteSlug, atoms }`。

### `src/notes-book.js`（DOM）

- 建立離屏量測容器，套用與實際頁面完全相同的樣式，提供 `measure` 與 `splitParagraph`。
- 呼叫 `buildNoteFlow` → `packAtoms` → 渲染所有頁面。
- 視窗尺寸變化不觸發重新分頁（版面固定），僅重算 fit-to-stage 縮放比例。

## 閱讀器外殼

沿用 `#pdf-view` 既有的 DOM 與控制項，不另做一套：側邊 PREV/NEXT、底部頁碼與拖曳捲軸、縮圖面板、工具列縮放與全螢幕。差別只在舞台裡放的是 HTML 頁面而非 canvas。

互動：

| 輸入 | 行為 |
| --- | --- |
| 左右方向鍵 | 上一／下一頁（桌機為跨頁） |
| 左右滑動 | 同上，含拖曳跟手與回彈 |
| 點擊側邊翻頁鈕 | 同上 |
| 拖曳底部捲軸 | 直接跳頁 |
| 縮圖面板 | 跳頁 |
| 雙指捏合／雙擊／工具列 ＋ − | 縮放 |
| 縮放後拖曳 | 平移 |

跨頁邏輯與 Issuu 相同：第 1 頁單獨置中，其後 (2,3)、(4,5) 成對。行動裝置一律單頁。

## 縮放

- 100% = 整頁塞滿舞台（fit-to-stage）。範圍 100%–400%。
- 以 CSS `transform: scale()` 作用在頁面元素上。HTML 文字為向量，放大至 400% 仍然銳利，這是相對 PDF canvas 的實質優勢。
- 手機初始狀態文字很小，需放大細讀，行為與 `/sense-and-sensibility` 一致。這是明確採納的取捨。

## 視覺

沿用既有 moonlight token，不新增色票：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--moon-ink` | `#071624` | 舞台底色 |
| `--moon-panel` | `#0b2031` | 頁面表面 |
| `--moon-panel-raised` | `#102a3d` | 頁面漸層上緣 |
| `--moon-ivory` | `#f3ead5` | 標題 |
| `--moon-copy` | `#e4dac4` | 內文 |
| `--moon-gold` | `#d5b169` | 線、編號、橫幅 |
| `--moon-rose` | `#bf7f89` | 點綴 |

母題以 inline SVG `<symbol>` 定義一次，各頁面型別以 `<use>` 取用，不使用點陣圖：

- `moon-halo`：左上月暈 radial glow
- `harp-strings`：右緣垂直金線
- `gold-swoosh`：底部金色流線
- `sakura`：低透明度櫻花瓣，數量極少

跨頁中央加一道細書溝陰影。翻頁動畫在桌機為 3D `rotateY`，行動裝置為橫向位移。

字體維持 `Noto Serif TC`（中文）與 `Bodoni Moda`（西文曲名）。

## 路由

- 路徑 `/moonlight-promise` 不變。
- `src/domain/routing.js` 的 `READER_VIEWS` 新增 `notes-book`，使 `default_reader_view: "notes-book"` 通過 `validReaderView`。
- `resolveProgrammeLayoutView` 改為：`reader_layout === "notes-book"` 時一律回傳 `notes-book`（取代原本 `programme-notes` → `contents` 的規則）。
- `parseReaderHash` 新增兩個前綴：
  - `#page/<n>`：跳至第 n 頁。
  - `#note/<slug>`：跳至該曲標題橫幅所在頁。
- 既有 `#chapter/<slug>` 在此 layout 下視為 `#note/<slug>` 的別名，維持相容。
- moonlight 的 `contents` 與 `chapter` 視圖不再有入口，但路由與 `[data-programme-theme="moonlight"]` 的既有樣式保留，作為深層連結的降級路徑。只刪除 `[data-reader-layout="programme-notes"]` 這一段。

## 無障礙

- 所有頁面常駐 DOM，不做虛擬化。螢幕報讀者得到一份連續可讀的文件，瀏覽器的頁內搜尋也能找到文字。
- 每頁包成 `<article>` 並帶頁次標籤。
- 翻頁時以 live region 播報目前頁次。
- 已知邊緣情況：頁內搜尋命中非當前頁時，舞台可能被瀏覽器捲動。監聽舞台 `scroll` 事件，將頁索引同步到實際位置。
- `prefers-reduced-motion` 時，翻頁動畫改為淡入淡出。
- 縮放控制項與翻頁鈕皆可鍵盤操作，focus ring 使用 `--moon-gold`。

## 檔案

| 檔案 | 動作 |
| --- | --- |
| `src/domain/notes-flow.js` | 新增 |
| `src/domain/notes-pagination.js` | 新增 |
| `src/notes-book.js` | 新增 |
| `src/reader.js` | 改：`notes-book` layout 走新模組，移除 `renderProgrammeNotes` 與 `programmeNoteList` |
| `src/domain/routing.js` | 改：認得 `notes-book`，支援 `#page/` 與 `#note/` |
| `src/data/sample-programme.js` | 改：`reader_layout: "notes-book"`，`default_reader_view: "notes-book"` |
| `styles.css` | 改：新增月光書頁樣式區塊，刪除 `[data-reader-layout="programme-notes"]` 全部規則 |
| `tests/` | 新增 flow 與 pagination 單元測試 |

舊的 `programme-notes` 長捲軸樣式與渲染函式一併移除，不保留死碼。

## 測試

單元測試（vitest，注入假量測器，不需 DOM）：

- `buildNoteFlow` 產出的原子順序與原始章節順序一致。
- **內容守恆**：把分頁結果攤平後，原子序列與 `buildNoteFlow` 輸出完全相同（段落切割後首尾相接還原）。這是最關鍵的不變式 —— 保證沒有任何一句解說在分頁時掉了。
- 沒有任何一頁超出容量。
- `note-banner` 不會落在頁尾而內文全在下一頁。
- `work-card` 不被切割。
- 段落切割後兩側各至少兩行。

手動驗證：320 / 375 / 768 / 1024 / 1440 寬度截圖，桌機與手機各翻完一輪，縮放至 400% 確認文字銳利。

## 分期

1. `notes-flow` 與 `notes-pagination` 純函式加測試。
2. `notes-book` 渲染、量測器、版面幾何。
3. 閱讀器外殼接線：翻頁、捲軸、縮圖、縮放、全螢幕、鍵盤、滑動。
4. 月光視覺與 SVG 母題。
5. 路由深層連結、reduced motion、無障礙、移除舊 `programme-notes` 程式碼與樣式。

## 風險

- **手機可讀性**：初始字級很小，需放大。使用者已在了解此取捨後確認採用。
- **分頁抖動**：字體載入完成前後量測結果可能不同。分頁需等 `document.fonts.ready` 後才執行，載入期間顯示既有的 `publication-placeholder`。
- **內容守恆**：由上述不變式測試防守。分頁引擎掉字是這個設計最嚴重的失敗模式。
