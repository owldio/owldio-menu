# OWLDIO MENU

表演藝術電子節目冊平台。公開端以手機掃碼後三秒內可讀為目標，提供原生垂直閱讀、章節跳轉與獨立演出網址；原始 PDF 是次要閱讀與下載功能。管理端提供節目冊建立、發布狀態與 PDF 上傳。

公開總覽採用「Rotunda Stage Archive（環形劇場書庫）」：中央節目冊聚焦、左右冊沿圓弧後退，可用箭頭、鍵盤或滑動切換；進入作品後轉為「Theatrical Editorial Modernism（劇場編輯現代主義）」閱讀系統。完整排版與素材規則見 [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)。框架不依賴示範照片，內建文章、導演信、曲目、人物、團隊與場館資訊等六種可直接套客戶內容的章節版型。

## Routes

- `/`：只顯示 `published` 節目冊的公開作品索引
- `/:clientSlug/:programmeSlug`：節目冊入口
- `/:clientSlug/:programmeSlug#contents`：章節目錄
- `/:clientSlug/:programmeSlug#chapter/:chapterSlug`：可直接分享的原生網頁章節
- `/:clientSlug/:programmeSlug#pdf`：原始 PDF
- `/admin`：管理後台

示範作品位於 `/ours/tide-awake`。

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

## Vercel and domain

專案使用 Vite，Vercel 建置指令與 SPA rewrites 已寫入 `vercel.json`。在 Vercel 設定與 `.env.local` 相同的兩個公開環境變數後部署，接著把 `menu.owldio.art` 加到專案。若 DNS 不由 Vercel 管理，依 Vercel 顯示的值在目前 DNS 供應商新增 subdomain CNAME，再等待憑證完成。

Architecture decisions are recorded in [`docs/adr`](docs/adr).
