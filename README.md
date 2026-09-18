# OWLDIO MENU

音樂會、合唱、歌劇與表演藝術電子節目冊平台。公開端以手機掃碼後三秒內可讀為目標，提供滿版作品索引、沉浸式 PDF 翻閱、原生網頁章節與獨立演出網址。管理端提供節目冊建立、發布狀態與 PDF 上傳。

公開總覽採用「B3-A Oxidised-Copper Editorial Spread（氧化銅出版跨頁）」：深氧化銅綠、紙本白與一條銅色細線構成滿版頁面，讓客戶節目冊以真實直式、方形或橫式跨頁比例成為主角。輪播保留前後景深，但不畫出軌道、圓盤或舞台拱門；滑鼠移入或鍵盤聚焦會暫停，按住拖曳會直接旋轉，箭頭切換會走完一格動畫。選定作品的標題、日期、場地與閱讀入口收在橫向出版頁腳。進入作品後，PDF 由 OWLDIO 自己渲染頁面、跨頁、縮圖、進度、縮放與全螢幕。完整規則見 [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)。

## Routes

- `/`：只顯示 `published` 節目冊的公開作品索引
- `/:clientSlug/:programmeSlug`：直接開啟節目冊閱讀器
- `/:clientSlug/:programmeSlug#entrance`：演出資訊入口
- `/:clientSlug/:programmeSlug#contents`：章節目錄
- `/:clientSlug/:programmeSlug#chapter/:chapterSlug`：可直接分享的原生網頁章節
- `/:programmeSlug#page/:pageNumber`：翻頁式樂曲解說的指定頁
- `/:programmeSlug#note/:noteSlug`：跳至指定曲目的樂曲解說
- `/admin`：管理後台

示範作品位於 `/yuan-chamber/sense-and-sensibility`；舊的 `/ours/tide-awake` 會自動轉址。

當印刷節目單裝不下樂曲解說時，節目冊可改用 `reader_layout: "notes-book"`：內容在瀏覽器裡排成固定版面的書頁，以跨頁、翻頁、縮圖與縮放閱讀，文字仍是可選取、可搜尋的 HTML。`/moonlight-promise` 是這種續頁的示範。

## Local development

需要 Node.js 22 以上。

```bash
npm install
npm run dev
```

驗證：

```bash
npm test
npm run build
```

未設定 Supabase 時，公開端會使用內建示範作品，`/admin` 會顯示後端連線步驟。

## Supabase setup

1. 在新的 Supabase 專案執行 [`supabase/migrations/202609010001_initial_programme_platform.sql`](supabase/migrations/202609010001_initial_programme_platform.sql)。
2. 在 Authentication 建立第一位後台使用者；正式環境請配置自有 SMTP，避免依賴預設寄信限制。
3. 以該使用者 UUID 建立管理權限：

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'owner@example.com'
on conflict (user_id) do nothing;
```

4. 複製 `.env.example` 為 `.env.local`，填入 Project URL 與 publishable key：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

請勿在瀏覽器或版本庫中使用 `service_role` key。資料表全部啟用 RLS；原始 PDF 存在私有 `programme-pdfs` bucket，公開閱讀時只會取得 15 分鐘的 signed URL。單檔上限為 25 MiB。

## Publication states

| 狀態 | 公開索引 | 獨立網址 | 後台 |
| --- | --- | --- | --- |
| `draft` | 不顯示 | 不可讀 | 可見 |
| `unlisted` | 不顯示 | 可讀 | 可見 |
| `published` | 顯示 | 可讀 | 可見 |
| `archived` | 不顯示 | 不可讀 | 可見 |

## Cloudflare Pages and domain

正式站使用 Cloudflare Pages，Production branch 為 `main`，建置指令為 `npm run build`，輸出目錄為 `dist`。專案不產生頂層 `404.html`，因此 Pages 會以原生 SPA fallback 讓 `/admin` 與節目冊獨立網址在重新整理時仍由應用程式接手；`public/_headers` 則為 Vite 的指紋化 assets 設定長效快取。

在 Pages 專案設定與 `.env.local` 相同的兩個公開環境變數後部署，再將 `menu.owldio.art` 加到 Custom domains。`owldio.art` 由同一個 Cloudflare 帳號管理時，Pages 會建立所需 DNS 紀錄並配置 SSL。

Architecture decisions are recorded in [`docs/adr`](docs/adr).
