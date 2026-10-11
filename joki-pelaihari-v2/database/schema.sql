-- Joki Pelaihari V2 — database migration v1
-- Apply only to the dedicated Joki Pelaihari Supabase project
-- No existing user or project tables are modified
create extension if not exists pgcrypto;

create table if not exists public.jp_admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'staff' check (role in ('owner','staff')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.jp_orders (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 customer_name text not null check (char_length(customer_name) between 2 and 120),
 level text not null default '',
 service text not null,
 deadline date,
 kesepakatan text not null default '',
 status text not null default 'baru' check(status in ('baru','diproses','revisi','selesai','dibatalkan')),
 payment_status text not null default 'belum_bayar' check(payment_status in ('belum_bayar','dp','lunas')),
 total numeric(14,0) not null default 0 check(total>=0),
 admin_note text not null default '',
 source text not null default 'website',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.jp_reviews (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 2 and 100),
 institution text not null default '',
 level text not null default '',
 service text not null default '',
 rating int not null check(rating between 1 and 5),
 text text not null check(char_length(text) between 10 and 1200),
 order_id uuid references public.jp_orders(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 verified boolean not null default false,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.jp_settings (
 id text primary key,
 data jsonb not null,
 version int not null default 1 check(version>=1),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.jp_events (
 id bigint generated always as identity primary key,
 event_type text not null check(event_type in ('page_view','whatsapp_click','instagram_click','calculator_use','order_open','order_submit','review_submit','price_view')),
 source text not null default 'website',
 created_at timestamptz not null default now()
);
create table if not exists public.jp_audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,
 entity text not null,
 entity_id text,
 created_at timestamptz not null default now()
);
create table if not exists public.jp_rate_limits (
 key text primary key,
 hits int not null default 1,
 reset_at timestamptz not null
);
create index if not exists jp_orders_created_idx on public.jp_orders(created_at desc);
create index if not exists jp_orders_status_idx on public.jp_orders(status, payment_status);
create index if not exists jp_reviews_status_idx on public.jp_reviews(status,created_at desc);
create index if not exists jp_events_type_idx on public.jp_events(event_type,created_at desc);
create index if not exists jp_audit_created_idx on public.jp_audit_logs(created_at desc);

-- Lock every table to the service role only. No browser may select/insert/update directly
alter table public.jp_admin_users enable row level security;
alter table public.jp_orders enable row level security;
alter table public.jp_reviews enable row level security;
alter table public.jp_settings enable row level security;
alter table public.jp_events enable row level security;
alter table public.jp_audit_logs enable row level security;
alter table public.jp_rate_limits enable row level security;

revoke all on public.jp_admin_users, public.jp_orders, public.jp_reviews,
 public.jp_settings, public.jp_events, public.jp_audit_logs, public.jp_rate_limits
 from anon, authenticated, public;
grant all on public.jp_admin_users, public.jp_orders, public.jp_reviews,
 public.jp_settings, public.jp_events, public.jp_audit_logs, public.jp_rate_limits
 to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.jp_consume_rate_limit(
 p_key text, p_max int, p_seconds int
) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare consumed int;
begin
 if p_key is null or length(p_key)<>64 or p_max not between 1 and 500 or p_seconds not between 60 and 86400 then
  return false;
 end if;
 insert into public.jp_rate_limits(key,hits,reset_at)
 values (p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set
 hits=case when public.jp_rate_limits.reset_at<now() then 1 else public.jp_rate_limits.hits+1 end,
 reset_at=case when public.jp_rate_limits.reset_at<now()
  then now()+make_interval(secs=>p_seconds) else public.jp_rate_limits.reset_at end
 returning hits into consumed;
 return consumed<=p_max;
end;
$$;
revoke all on function public.jp_consume_rate_limit(text,int,int) from public, anon, authenticated;
grant execute on function public.jp_consume_rate_limit(text,int,int) to service_role;

-- Bootstrap owner: add a verified Supabase Auth user, then whitelist its email
-- in the encrypted Vercel env JP_ADMIN_EMAILS, or insert its auth.users UUID
-- into jp_admin_users as role=owner. Never store passwords in SQL or GitHub
