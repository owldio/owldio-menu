begin;

alter table public.programmes
  drop constraint if exists programmes_client_slug_slug_unique;

alter table public.programmes
  add constraint programmes_slug_unique unique (slug);

comment on column public.programmes.client_slug is
  'Internal client grouping key; not part of the public programme URL.';

comment on column public.programmes.slug is
  'Globally unique public path segment used as /{slug} on menu.owldio.art.';

commit;
