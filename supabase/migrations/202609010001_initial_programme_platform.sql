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
  title text not null,
  title_en text,
  body text,
  page_start integer,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_chapters_position_positive check (position > 0),
  constraint programme_chapters_page_positive check (page_start is null or page_start > 0),
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
  title,
  title_en,
  body,
  page_start
)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  1,
  'room-of-the-wakeful',
  '第一場　失眠者的房間',
  'SCENE I · THE ROOM OF THE WAKEFUL',
  '凌晨兩點十七分，城市的潮聲穿過沒有關緊的窗。',
  5
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
