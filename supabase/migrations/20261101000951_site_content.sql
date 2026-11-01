-- Content the public site reads, edited from the secret studio page.
-- Visitors (anon) can only read visible rows. Every write goes through the
-- `admin` Edge Function, which checks the studio key and uses the service role.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  sort integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  badge text check (char_length(badge) <= 60),
  price text check (char_length(price) <= 40),
  duration text check (char_length(duration) <= 40),
  short text check (char_length(short) <= 160),
  description text check (char_length(description) <= 2000),
  good_for text check (char_length(good_for) <= 160),
  image_url text check (char_length(image_url) <= 500),
  featured boolean not null default false,
  booking_url text check (char_length(booking_url) <= 500),
  visible boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index treatments_category_id_idx on public.treatments (category_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  brand text check (char_length(brand) <= 80),
  category text check (char_length(category) <= 60),
  price text check (char_length(price) <= 40),
  description text check (char_length(description) <= 2000),
  image_url text check (char_length(image_url) <= 500),
  buy_url text check (char_length(buy_url) <= 500),
  sold_out boolean not null default false,
  visible boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- sha256 of the key in the studio link; never readable through the API
create table public.admin_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  created_at timestamptz not null default now()
);

-- a treatment keeps the anchor it was created with (links point at it)
create or replace function public.treatments_set_slug()
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
      base := 'treatment';
    end if;
    candidate := base;
    while exists (select 1 from public.treatments t where t.slug = candidate and t.id <> new.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end;
$$;

create trigger treatments_slug before insert on public.treatments
  for each row execute function public.treatments_set_slug();
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger treatments_touch before update on public.treatments
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.categories enable row level security;
alter table public.treatments enable row level security;
alter table public.products enable row level security;
alter table public.admin_keys enable row level security;

create policy "Visible categories are public" on public.categories
  for select to anon, authenticated using (visible);
create policy "Visible treatments are public" on public.treatments
  for select to anon, authenticated using (visible);
create policy "Visible products are public" on public.products
  for select to anon, authenticated using (visible);
-- admin_keys: no policies, so only the service role can touch it

revoke insert, update, delete, truncate on public.categories, public.treatments, public.products from anon, authenticated;
revoke all on public.admin_keys from anon, authenticated;

-- photos uploaded from the studio; public URLs, uploads only via the Edge Function
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/webp', 'image/jpeg', 'image/png']);
