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

頁寬固定、頁高跟著螢幕。行長不變，閱讀密度就不變；頁高順著舞台長寬比，書頁才會塞滿畫面而不是浮在中間留一圈空白。

| 參數 | 值 |
| --- | --- |
| 頁面邏輯寬度 | 800 px（固定） |
| 頁面邏輯高度 | `spreadWidth × stageHeight ÷ stageWidth`，夾在 900–2400 px |
| 左右留白 | 80 px |
| 上留白 | 92 px |
| 下留白 | 84 px（含頁腳） |
| 文字欄寬 | 640 px |
| 內文字級 | 16 px |
| 行高 | 1.9（行盒 30.4 px） |
| 每行字數 | 約 38 字 |

頁腳位於頁面內，因此實際可用高度是版心高度扣掉頁腳。容量不寫成常數，而是在排版前量測一張真實頁面的版心高度，避免常數與樣式各說各話。

頁高會變，代表一頁能裝多少字也會變，所以尺寸改變時要重新分頁。重排前記下當前跨頁第一個原子的 id，重排後回到那個原子所在的頁，讀者不會被丟到書的別處。重排以 180 ms 去彈跳，縮放則即時套用，拖曳視窗時不會卡頓。

實測頁數：手機 375 × 812 為 14 頁；桌機 1440 × 900 跨頁為 20 頁 10 個跨頁。

## 頁面地圖

| 頁 | 類型 | 內容 |
| --- | --- | --- |
| 01 | `cover` | 月暈、豎琴弦、櫻花；「樂曲解說 / PROGRAMME NOTES」；日期、場地 |
| 02 | `contents` | 七首曲目編號清單，含中場休息分隔；點擊跳至該曲 |
| 03– | `note` | 七首曲，各自「標題橫幅 → 內文」，續頁只有內文與頁腳 |
| 末 | `colophon` | 演出資訊、主辦協辦、回節目單封面 |

每首曲的首頁頂端是金色標題橫幅：編號、中文曲名、英文曲名、編制。不做獨立扉頁 —— 碎心花只有 208 字，扉頁加一頁內文會留下大片空白，也多一次無意義的翻頁。

**每首曲一律開新頁**，即使上一首只用掉半頁。兩首曲共用一頁讀起來像排版失誤。這也讓每一頁只屬於一首曲，頁眉與深層連結不再有歸屬歧義。

目錄頁的列高壓到最矮頁面（900 px）也放得下七首曲加中場休息。曲目再多就需要把目錄拆成可分頁的原子；目前的節目沒有這個需求。

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
2. `note-banner` 一律開新頁（當前頁已有內容時先收頁）。
3. `paragraph` 可跨頁，但兩側各至少保留兩行（避免孤行寡行）。當前頁剩餘高度不足兩行時，不切割，整段推到下一頁。
4. `work-card` 不可分割；放不下就整張推到下一頁。
5. 容量由量測器回報，已扣掉頁腳所佔的高度。
6. 單一原子高度超過整頁容量時（理論上只可能是超長段落），強制切割並允許最後一段溢出，不得丟棄內容。

`Page` 形狀：`{ index, kind, noteSlug, atoms }`。

因為每首曲各自開頁，一頁只會屬於一首曲，`noteSlug` 直接取第一個帶曲目的原子。跳至某曲時仍直接尋找帶該曲橫幅的原子，不依賴頁面標籤。

### `src/notes-book.js`（DOM）

- 建立離屏量測容器，與實際頁面共用同一個 `createPageFrame`，提供 `capacity`、`measure` 與 `splitParagraph`。
- 量測容器掛在 `document.body`：排版發生在檢視區仍是 `hidden` 的時候，掛在檢視區內會讓每個原子都量到 0，整本書靜靜塌成一頁。量測器啟動時先跑一次探針，量不到就拋錯，讓失敗大聲而不是安靜。
- 量測節點後面補一個零高度哨兵，避免 `:last-child` 之類的樣式改變被量測的對象。
- 排版前以 `document.fonts.load()` 指名載入實際字面並帶入書中的取樣文字。`document.fonts.ready` 會在沒有任何元素用到該字型時提早 resolve，而 Google Fonts 以 unicode-range 分包提供中文；只等 ready 會量到 fallback 字寬，每一頁都會溢出。
- 呼叫 `buildNoteFlow` → `packAtoms` → 渲染所有頁面。
- 首次排版延到 `activate()`，舞台有實際尺寸時才做；尺寸改變且頁高差超過 24 px 時重新分頁（見〈版面幾何〉）。

## 閱讀體驗（手機實測後修訂）

在 iPhone 上實測發現的問題與對應：

- **iOS 文字自動放大**：Safari 會把「比螢幕寬、字又多」的區塊字級調大。書頁邏輯寬 800 px 再縮放，正好被判定要放大，導致文字比量測時大、溢出到頁碼與進度條底下。修正：`html { text-size-adjust: 100% }`。
- **沉浸式版面**：書頁佔滿整個螢幕，工具列、翻頁箭頭、進度條改為浮在頁面上的圖層（`data-chrome`），閒置 2.8 秒自動收起，點畫面中央叫回。因為是疊加而非堆疊，顯示或收起不改變頁面尺寸，不會重排。載入期間工具列固定顯示，保留返回的路。
- **點擊翻頁**：左 30% 上一頁、右 30% 下一頁、中間顯示選單。單擊延遲 260 ms 判定，才能和雙擊區分。放大狀態下點擊只切換選單，不翻頁。
- **滑動**：所有頁面排在一條橫向帶上（`pageOffset`），拖曳時下一頁真的從側邊跟著手指進來；拖過 18% 寬度或快速甩動（≥0.35 px/ms）就翻頁，反向甩動取消；首尾頁拖曳有 0.3 的阻尼。滑鼠拖曳保留給選取文字，不翻頁。
- **縮放**：雙擊以點擊位置放大到 250%，再雙擊回 100%。兩指捏合為自由連續縮放，上限 400%；捏合過程可超出上下限一些（橡皮筋），放手後超過上限回到 400%、低於原尺寸回到 100% 並置中。
- **載入**：品牌化載入畫面遮住仍在排版的書頁；字型最多等 3.5 秒，逾時先以已到的字型排版，完整字型抵達後再強制重排一次。
- **首次提示**：第一次打開顯示三區操作說明，4.2 秒或任一次點擊後消失，記錄在 `localStorage`。
- **跳頁**：相鄰頁滑動；跳多頁（目錄、縮圖、捲軸、深層連結）改為淡入，不讓讀者看著書頁一路刷過去。

判斷邏輯（點擊區、雙擊、滑動速度、翻頁判定、邊緣阻尼、縮放回彈）全部放在 `src/domain/reader-gestures.js` 的純函式，有單元測試。

## 閱讀器外殼

獨立的 `#notes-book-view`，但沿用 PDF 閱讀器的同一組 chrome class：`publication-toolbar`、`publication-turn`、`publication-rail`、`publication-thumbnails`。兩者共用外觀語彙，卻不共用 DOM —— `#pdf-view` 由 `createPublicationViewer` 綁定，兩個引擎搶同一批節點只會互相踩到。月光下的約定同時有印刷三折頁與樂曲解說，本來就需要兩個並存的檢視。

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

母題不使用點陣圖。純氛圍的部分交給 CSS 漸層，有形狀的部分才畫成 inline SVG：

- 月暈：頁面與舞台的 `radial-gradient`
- 豎琴弦：舞台的 `repeating-linear-gradient` 垂直金線
- 金色流線：封面與尾頁的 inline SVG 貝茲曲線，出血後由頁面裁切
- 櫻花瓣：封面的 inline SVG，四片、低不透明度

跨頁中央加一道細書溝陰影，只在真正並排兩頁時出現。翻頁為方向感的位移加淡入淡出：離場頁往行進方向退開，入場頁補上。不做 3D `rotateY` —— 在低對比的深色頁面上，翻轉的中間影格讀起來只是閃爍。

字體維持 `Noto Serif TC`（中文）與 `Bodoni Moda`（西文曲名）。

## 節目單設計層

這本書是節目單本身，只是不印出來。因此每首曲的開頭頁要像節目單的曲目頁，而不是網頁文章：

- **標題帶出血到頁緣**：負邊距抵銷頁面留白，金色帶佔滿整個版面寬度並貼齊頁頂。每首曲都開新頁，所以標題帶永遠在頁頂。
- **編制與演出者**：標題帶上列出編制（弦樂四重奏與豎琴、鋼琴四重奏……）與每位演出者，資料取自印刷三折頁的曲目面，存在 `moonlight-promise-notes.js` 的 `ensemble` 與 `performers`。
- **導言段**：每首曲第一段放大、提亮、不縮排、左側金線。以齊左排，因為在這個字級下，長串拉丁人名會把兩端對齊撐出字距河流。
- **續頁書眉**：續頁的上留白放「曲號　曲名（續）」，頁腳左側也改為曲名。書眉位於留白區，不佔版心容量。
- **齊底**：分頁無法恰好落在最後一行，剩餘高度平均分到段距，每段最多 14 px，避免把短頁撐開。
- **收束頁**：某曲最後一頁若只剩少量文字（低於版心 55%）且不是開頭頁，內容垂直置中並以金線加 ✦ 收尾，讓短頁成為刻意的結尾而非斷掉的頁面。
- **封面**：直排兩行的「月光下／的約定」、海報式大字日期「2026 / 9.25（五）19:30」、被頁緣裁切的月輪、豎琴弦與櫻花瓣。主辦與協辦列在封面與尾頁。

## 路由

- 路徑 `/moonlight-promise` 不變。
- `src/domain/routing.js` 的 `READER_VIEWS` 新增 `notes-book`，使 `default_reader_view: "notes-book"` 通過 `validReaderView`。
- `resolveProgrammeLayoutView` 改為：`reader_layout === "notes-book"` 時，`pdf` 仍回傳 `pdf`，其餘一律回傳 `notes-book`。印刷三折頁必須留得住，尾頁與工具列都有入口。
- 網址的 hash 由書本自己維護：翻頁時 `replaceState` 寫入 `#page/N`，`showRoute` 不再改寫 notes-book 的網址。否則正規化網址會把訪客帶進來的 `#note/...` 洗掉。
- `parseReaderHash` 新增兩個前綴：
  - `#page/<n>`：跳至第 n 頁。
  - `#note/<slug>`：跳至該曲標題橫幅所在頁。
- 既有 `#chapter/<slug>` 在此 layout 下視為 `#note/<slug>` 的別名，由 `resolveNoteAnchor` 統一解析，`parseReaderHash` 的回傳形狀不變。
- moonlight 的 `contents` 與 `chapter` 視圖不再有入口，但路由與 `[data-programme-theme="moonlight"]` 的既有樣式保留，作為深層連結的降級路徑。只刪除 `[data-reader-layout="programme-notes"]` 這一段。

## 無障礙

- 所有頁面常駐 DOM，不做虛擬化。螢幕報讀者得到一份連續可讀的文件，瀏覽器的頁內搜尋也能找到文字。
- 每頁包成 `<article>` 並帶頁次標籤。
- 翻頁時以 live region 播報目前頁次。
- 頁內搜尋命中非當前頁時，瀏覽器會捲動舞台。監聽舞台 `scroll`，跟著選取範圍翻到該頁，再把舞台捲回原位。
- `prefers-reduced-motion` 時，翻頁動畫改為淡入淡出。
- 縮放控制項與翻頁鈕皆可鍵盤操作，focus ring 使用 `--moon-gold`。

## 檔案

| 檔案 | 動作 |
| --- | --- |
| `src/domain/notes-flow.js` | 新增：章節攤平成原子 |
| `src/domain/notes-pagination.js` | 新增：裝箱與跨頁配對 |
| `src/domain/notes-geometry.js` | 新增：頁寬常數與隨舞台而定的頁高 |
| `src/domain/datetime.js` | 新增：日期格式化，自 `reader.js` 抽出共用 |
| `src/lib/dom.js` | 新增：`createElement`，自 `reader.js` 抽出共用 |
| `src/notes-book.js` | 新增：書本狀態、導覽、縮放 |
| `src/notes-book-render.js` | 新增：原子與頁面的 DOM |
| `src/notes-book-measure.js` | 新增：離屏量測與段落切割 |
| `src/notes-book-gestures.js` | 新增：觸控狀態機（點擊、雙擊、拖曳、捏合、平移） |
| `src/notes-book-chrome.js` | 新增：浮動控制列的顯示與自動收起 |
| `src/notes-book-overlays.js` | 新增：載入畫面與首次提示 |
| `src/domain/reader-gestures.js` | 新增：手勢判斷純函式 |
| `index.html` | 改：新增 `#notes-book-view` 區塊 |
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
- 每首曲都從新的一頁開始，沒有兩首曲共用一頁。
- `resolvePageHeight` 依舞台比例產出頁高並受上下限保護。
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
- **分頁抖動**：字體載入完成前後量測結果不同。排版前以 `document.fonts.load()` 指名載入實際字面與取樣文字，不只等 `document.fonts.ready`。
- **內容守恆**：由上述不變式測試防守。分頁引擎掉字是這個設計最嚴重的失敗模式。
