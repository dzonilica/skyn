-- Site text and photos, the before & after gallery, and product pages.
-- Same rules as the first migration: visitors read, the `admin` Edge Function writes.

-- Text and photos on the pages. One row per changed element (the key matches
-- data-edit="..." in the HTML); an element without a row keeps the text in the
-- HTML. An empty value hides the element.
create table public.site_content (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  value text not null check (char_length(value) <= 4000),
  updated_at timestamptz not null default now()
);

create trigger site_content_touch before update on public.site_content
  for each row execute function public.touch_updated_at();

alter table public.site_content enable row level security;
create policy "Site content is public" on public.site_content
  for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.site_content from anon, authenticated;

-- Before & after photos (Results page; `home` = one of the three on the Home page)
create table public.results (
  id uuid primary key default gen_random_uuid(),
  title text check (char_length(title) <= 120),
  treatment text check (char_length(treatment) <= 80),
  image_url text not null check (char_length(image_url) between 1 and 500),
  home boolean not null default false,
  visible boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger results_touch before update on public.results
  for each row execute function public.touch_updated_at();

alter table public.results enable row level security;
create policy "Visible results are public" on public.results
  for select to anon, authenticated using (visible);
revoke insert, update, delete, truncate on public.results from anon, authenticated;

-- the six photos the site launched with, in the Results page order
insert into public.results (title, image_url, home, sort) values
  ('Full-face comparison', 'assets/img/ba-3.webp', true, 0),
  ('Cheek and side profile', 'assets/img/ba-2.webp', false, 1),
  ('Face and forehead', 'assets/img/ba-6.webp', true, 2),
  ('Overhead facial comparison', 'assets/img/ba-5.webp', false, 3),
  ('Nose and cheek detail', 'assets/img/ba-1.webp', true, 4),
  ('Neck close-up', 'assets/img/ba-4.webp', false, 5);

-- Products get a page of their own: product.html?p=<slug>. Like treatments, a
-- product keeps the slug it was created with, so shared links keep working.
alter table public.products add column slug text;

create or replace function public.products_set_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if new.slug is null or new.slug = '' then
    base := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
    if base = '' then
      base := 'product';
    end if;
    candidate := base;
    while exists (select 1 from public.products p where p.slug = candidate and p.id <> new.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end;
$$;

create trigger products_slug before insert or update of slug on public.products
  for each row execute function public.products_set_slug();

-- existing products: the trigger fills in the slug
update public.products set slug = null;

alter table public.products alter column slug set not null;
alter table public.products add constraint products_slug_key unique (slug);
