begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Admins can inspect their own access"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  slug text not null,
  title text not null,
  title_en text,
  summary text,
  production_type text,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  visibility text not null default 'draft',
  cover_theme text not null default 'sage',
  pdf_path text,
  pdf_filename text,
  pdf_size_bytes bigint,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programmes_client_slug_format check (client_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint programmes_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint programmes_client_slug_slug_unique unique (client_slug, slug),
  constraint programmes_visibility_valid check (visibility in ('draft', 'unlisted', 'published', 'archived')),
  constraint programmes_duration_positive check (duration_minutes is null or duration_minutes > 0),
  constraint programmes_pdf_size_valid check (pdf_size_bytes is null or pdf_size_bytes between 1 and 26214400),
  constraint programmes_dates_valid check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index programmes_visibility_starts_at_idx on public.programmes (visibility, starts_at desc);
create index programmes_created_by_idx on public.programmes (created_by);
create index programmes_pdf_path_idx on public.programmes (pdf_path) where pdf_path is not null;

create table public.programme_chapters (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  position integer not null,
  slug text not null,
  kind text not null default 'essay',
  eyebrow text,
  title text not null,
  title_en text,
  body text,
  blocks jsonb not null default '[]'::jsonb,
  page_start integer,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_chapters_position_positive check (position > 0),
  constraint programme_chapters_page_positive check (page_start is null or page_start > 0),
  constraint programme_chapters_kind_valid check (kind in ('essay', 'programme', 'letter', 'people', 'credits', 'visitor')),
  constraint programme_chapters_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint programme_chapters_programme_position_unique unique (programme_id, position),
  constraint programme_chapters_programme_slug_unique unique (programme_id, slug)
);

create index programme_chapters_programme_id_idx on public.programme_chapters (programme_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger programmes_touch_updated_at
before update on public.programmes
for each row execute function private.touch_updated_at();

create trigger programme_chapters_touch_updated_at
before update on public.programme_chapters
for each row execute function private.touch_updated_at();

alter table public.programmes enable row level security;
alter table public.programme_chapters enable row level security;

create policy "Released programmes are readable by URL"
on public.programmes
for select
to anon, authenticated
using (visibility in ('published', 'unlisted'));

create policy "Admins can read every programme"
on public.programmes
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create programmes"
on public.programmes
for insert
to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));

create policy "Admins can update programmes"
on public.programmes
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete programmes"
on public.programmes
for delete
to authenticated
using ((select private.is_admin()));

create policy "Visible chapters of released programmes are readable"
on public.programme_chapters
for select
to anon, authenticated
using (
  is_visible
  and exists (
    select 1
    from public.programmes
    where programmes.id = programme_chapters.programme_id
      and programmes.visibility in ('published', 'unlisted')
  )
);

create policy "Admins can read every chapter"
on public.programme_chapters
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create chapters"
on public.programme_chapters
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update chapters"
on public.programme_chapters
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete chapters"
on public.programme_chapters
for delete
to authenticated
using ((select private.is_admin()));

revoke all on table public.admin_users, public.programmes, public.programme_chapters from anon, authenticated;
grant select on table public.admin_users to authenticated;
grant select on table public.programmes, public.programme_chapters to anon, authenticated;
grant insert, update, delete on table public.programmes, public.programme_chapters to authenticated;

insert into public.programmes (
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
  published_at
)
values (
  '00000000-0000-4000-8000-000000000001',
  'ours',
  'tide-awake',
  '潮聲未眠',
  'THE TIDE STAYS AWAKE',
  '一座入夜後仍記得潮汐的城市，與三個不願睡去的人。',
  '原創音樂劇',
  '北城實驗劇場',
  '2026-09-18 19:30:00+08',
  '2026-09-20 21:20:00+08',
  110,
  'published',
  'sage',
  now()
);

insert into public.programme_chapters (
  id,
  programme_id,
  position,
  slug,
  kind,
  eyebrow,
  title,
  title_en,
  body,
  blocks,
  page_start
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    1,
    'room-of-the-wakeful',
    'essay',
    'SCENE I',
    '第一場　失眠者的房間',
    'SCENE I · THE ROOM OF THE WAKEFUL',
    '凌晨兩點十七分，城市的潮聲穿過沒有關緊的窗。',
    $$[
      {"type":"lede","text":"凌晨兩點十七分，城市的潮聲穿過沒有關緊的窗。黎安坐在地板上，把同一段旋律反覆彈了十九次。"},
      {"type":"prose","paragraphs":["《潮聲未眠》從一個很小的問題開始：如果一座城市不再做夢，還有誰會替它記得曾經失去的人？","第一場沒有完整的歌。鋼琴、呼吸與鞋底摩擦地板的聲音先建立節奏。"]},
      {"type":"score","number":"I.","label":"OPENING NUMBER","title":"〈潮線以北〉","details":[["Tempo","Adagio, ♩ = 54"],["Players","Piano · Viola · Voice"],["Duration","06′ 40″"]]},
      {"type":"quote","text":"我們不是為了醒著而醒著。只是海還沒有把最後一句話說完。","cite":"黎安，第一場"}
    ]$$::jsonb,
    5
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    2,
    'music-and-scenes',
    'programme',
    'MUSIC & SCENES',
    '曲目與場次',
    'MUSIC & SCENES',
    null,
    $$[
      {"type":"lede","text":"七段音樂像七次潮汐：不是把故事切開，而是讓觀眾知道此刻站在哪一條岸線上。"},
      {"type":"programme-list","items":[["01","潮線以北","鋼琴、低音提琴與人聲","06′40″"],["02","沒有寄出的海圖","黎安／獨唱","08′15″"],["03","第三盞路燈","三重唱","05′30″"],["04","城市睡去以前","器樂間奏","04′20″"],["05","退潮的人","岑雨／獨唱","07′10″"],["06","把名字留在岸上","全體","09′05″"],["07","天亮仍有浪","終曲","06′55″"]]}
    ]$$::jsonb,
    7
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000001',
    3,
    'directors-note',
    'letter',
    'DIRECTOR''S NOTE',
    '導演的話　關於沒有睡著的海',
    'A NOTE ON THE SLEEPLESS SEA',
    null,
    $$[
      {"type":"dateline","text":"臺北，2026 年初秋"},
      {"type":"lede","text":"劇場裡的夜晚很奇怪。燈一暗，我們反而開始看見白天不敢承認的事。"},
      {"type":"prose","paragraphs":["這齣戲沒有要解釋失眠，也不想把離開說成一件漂亮的事。我們只是陪三個人坐到天亮。","謝謝每一位在排練場裡容許沉默發生的人，也謝謝今晚坐在觀眾席裡的你。"]},
      {"type":"signature","name":"周棲","role":"導演暨共同編劇"}
    ]$$::jsonb,
    9
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000001',
    4,
    'cast-and-musicians',
    'people',
    'CAST & MUSICIANS',
    '演員與樂手',
    'CAST & MUSICIANS',
    null,
    $$[
      {"type":"people-list","items":[["黎安","林以森","在城市檔案室值夜班，把旋律寫在借閱單背面。"],["岑雨","陳穗","聲音採集者，記得每一場雨卻忘了自己的生日。"],["阿默","高未明","末班渡船的駕駛，也是唯一聽得見退潮的人。"],["鋼琴","羅以安","現場演奏／音樂共同創作。"],["中提琴","徐方庭","現場演奏。"],["低音提琴","黃知遠","現場演奏。"]]}
    ]$$::jsonb,
    11
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    '00000000-0000-4000-8000-000000000001',
    5,
    'creative-team',
    'credits',
    'CREATIVE & PRODUCTION TEAM',
    '幕後製作團隊',
    'CREATIVE & PRODUCTION TEAM',
    null,
    $$[
      {"type":"credits","groups":[{"title":"創作","items":[["編劇","周棲、許白"],["導演","周棲"],["作曲","羅以安"],["編舞","夏維"]]},{"title":"舞台","items":[["舞台設計","王重山"],["燈光設計","葉霧"],["服裝設計","杜嘉"],["音響設計","江泊"]]},{"title":"製作","items":[["製作人","溫晴"],["舞台監督","張珞"],["執行製作","陳亭"],["平面設計","OWLDIO"]]}]}
    ]$$::jsonb,
    13
  ),
  (
    '00000000-0000-4000-8000-000000000106',
    '00000000-0000-4000-8000-000000000001',
    6,
    'visitor-information',
    'visitor',
    'VISITOR INFORMATION',
    '演出資訊與場館須知',
    'VISITOR INFORMATION',
    null,
    $$[
      {"type":"info-grid","items":[["演出長度","約 110 分鐘，無中場休息"],["建議年齡","建議 12 歲以上觀眾入場"],["遲到入場","依現場工作人員指示，於適當段落入場"],["字幕","中文演出；部分場次提供英文字幕"]]},
      {"type":"notice","title":"演出提醒","text":"演出使用煙霧、瞬間強光與較大音量。觀眾席內請關閉會發光或發出聲響的裝置。"},
      {"type":"notice","title":"節目冊保存","text":"本頁於演後仍會保留。原始 PDF 可下載收藏；最新演出異動以現場公告為準。"}
    ]$$::jsonb,
    15
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('programme-pdfs', 'programme-pdfs', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Released programme PDFs can receive signed URLs"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'programme-pdfs'
  and exists (
    select 1
    from public.programmes
    where programmes.pdf_path = storage.objects.name
      and programmes.visibility in ('published', 'unlisted')
  )
);

create policy "Admins can read programme PDFs"
on storage.objects
for select
to authenticated
using (bucket_id = 'programme-pdfs' and (select private.is_admin()));

create policy "Admins can upload programme PDFs"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'programme-pdfs' and (select private.is_admin()));

create policy "Admins can replace programme PDFs"
on storage.objects
for update
to authenticated
using (bucket_id = 'programme-pdfs' and (select private.is_admin()))
with check (bucket_id = 'programme-pdfs' and (select private.is_admin()));

create policy "Admins can delete programme PDFs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'programme-pdfs' and (select private.is_admin()));

commit;
