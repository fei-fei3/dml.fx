-- BULL FX database schema v2
-- Run this in Supabase SQL Editor (replaces v1)

-- ===========================
-- USER PROFILES
-- ===========================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  mt5_account text unique,           -- their MT5/MT4 account number
  full_name text,
  is_admin boolean default false,
  deposit_verified boolean default false,
  deposit_verified_at timestamptz,
  deposit_verified_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Auto-create profile when user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===========================
-- TRADES (existing)
-- ===========================
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  pair text not null,
  direction text not null check (direction in ('Long', 'Short')),
  entry numeric, exit numeric, stop_loss numeric, take_profit numeric,
  size numeric, pnl numeric, rr numeric,
  strategy text, emotion text, notes text, screenshot text,
  created_at timestamptz default now()
);
create index if not exists trades_user_id_idx on trades(user_id);

-- ===========================
-- AIMS LOT IMPORT TRACKING
-- ===========================
-- Stores raw rows from each CSV import (audit trail + dedup)
create table if not exists lot_imports (
  id uuid primary key default gen_random_uuid(),
  mt5_account text not null,
  client_email text,
  client_name text,
  close_date date not null,
  lots numeric not null,
  imported_by uuid references auth.users(id),
  imported_at timestamptz default now(),
  unique(mt5_account, close_date)  -- prevents double-counting same day
);
create index if not exists lot_imports_mt5_idx on lot_imports(mt5_account);
create index if not exists lot_imports_date_idx on lot_imports(close_date);

-- ===========================
-- MONTHLY CREDIT BALANCE
-- ===========================
-- One row per user per month (auto-resets monthly)
create table if not exists monthly_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year_month text not null,                -- "2026-04"
  lots_this_month numeric default 0,
  gb_earned integer default 0,             -- 0-5
  mb_total integer default 0,              -- gb_earned * 1024 + bonuses
  mb_used integer default 0,
  admin_bonus_mb integer default 0,        -- manually granted by admin
  updated_at timestamptz default now(),
  unique(user_id, year_month)
);
create index if not exists monthly_credits_user_idx on monthly_credits(user_id);
create index if not exists monthly_credits_month_idx on monthly_credits(year_month);

-- ===========================
-- CREDIT TRANSACTIONS (audit log)
-- ===========================
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year_month text not null,
  type text not null check (type in ('grant_lot', 'grant_admin', 'spend_insight', 'spend_forecast', 'monthly_reset')),
  mb_delta integer not null,               -- + for grant, - for spend
  description text,
  created_at timestamptz default now()
);
create index if not exists credit_tx_user_idx on credit_transactions(user_id);
create index if not exists credit_tx_created_idx on credit_transactions(created_at desc);

-- ===========================
-- ROW LEVEL SECURITY
-- ===========================
alter table profiles enable row level security;
alter table trades enable row level security;
alter table lot_imports enable row level security;
alter table monthly_credits enable row level security;
alter table credit_transactions enable row level security;

-- Profiles: users see their own, admins see all
drop policy if exists "view own profile" on profiles;
create policy "view own profile" on profiles for select
  using (auth.uid() = id or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
  using (auth.uid() = id);

drop policy if exists "admin update any profile" on profiles;
create policy "admin update any profile" on profiles for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- Trades: users only see their own
drop policy if exists "view own trades" on trades;
create policy "view own trades" on trades for select using (auth.uid() = user_id);
drop policy if exists "insert own trades" on trades;
create policy "insert own trades" on trades for insert with check (auth.uid() = user_id);
drop policy if exists "update own trades" on trades;
create policy "update own trades" on trades for update using (auth.uid() = user_id);
drop policy if exists "delete own trades" on trades;
create policy "delete own trades" on trades for delete using (auth.uid() = user_id);

-- Lot imports: admin only
drop policy if exists "admin only lot imports" on lot_imports;
create policy "admin only lot imports" on lot_imports for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- Monthly credits: users see own, admins see all
drop policy if exists "view own credits" on monthly_credits;
create policy "view own credits" on monthly_credits for select
  using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "admin manage credits" on monthly_credits;
create policy "admin manage credits" on monthly_credits for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- Credit transactions: users see own, admin sees all
drop policy if exists "view own tx" on credit_transactions;
create policy "view own tx" on credit_transactions for select
  using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- ===========================
-- HELPER FUNCTIONS
-- ===========================

-- Get current month's credits for a user (creates row if needed)
create or replace function get_or_create_monthly_credit(p_user_id uuid)
returns monthly_credits as $$
declare
  current_ym text := to_char(now(), 'YYYY-MM');
  result monthly_credits;
begin
  select * into result from monthly_credits where user_id = p_user_id and year_month = current_ym;
  if not found then
    insert into monthly_credits (user_id, year_month) values (p_user_id, current_ym)
    returning * into result;
  end if;
  return result;
end;
$$ language plpgsql security definer;

-- Spend MB (called by edge functions). Returns true if successful.
create or replace function spend_credit(p_user_id uuid, p_mb integer, p_type text, p_desc text)
returns boolean as $$
declare
  current_ym text := to_char(now(), 'YYYY-MM');
  available integer;
begin
  perform get_or_create_monthly_credit(p_user_id);
  select (mb_total - mb_used) into available from monthly_credits
    where user_id = p_user_id and year_month = current_ym;
  if available < p_mb then
    return false;
  end if;
  update monthly_credits set mb_used = mb_used + p_mb, updated_at = now()
    where user_id = p_user_id and year_month = current_ym;
  insert into credit_transactions (user_id, year_month, type, mb_delta, description)
    values (p_user_id, current_ym, p_type, -p_mb, p_desc);
  return true;
end;
$$ language plpgsql security definer;

-- Recalculate a user's monthly credit from lot_imports (called after CSV import)
create or replace function recalculate_monthly_credit(p_mt5_account text)
returns void as $$
declare
  current_ym text := to_char(now(), 'YYYY-MM');
  v_user_id uuid;
  v_lots numeric;
  v_gb integer;
begin
  select id into v_user_id from profiles where mt5_account = p_mt5_account;
  if v_user_id is null then return; end if;

  select coalesce(sum(lots), 0) into v_lots from lot_imports
    where mt5_account = p_mt5_account
    and to_char(close_date, 'YYYY-MM') = current_ym;

  v_gb := least(floor(v_lots)::int, 5);

  perform get_or_create_monthly_credit(v_user_id);
  update monthly_credits
    set lots_this_month = v_lots,
        gb_earned = v_gb,
        mb_total = (v_gb * 1024) + admin_bonus_mb,
        updated_at = now()
  where user_id = v_user_id and year_month = current_ym;
end;
$$ language plpgsql security definer;

-- ===========================
-- SET YOUR ADMIN EMAIL
-- ===========================
-- IMPORTANT: After signing up, run this manually:
-- update profiles set is_admin = true where email = 'YOUR_EMAIL_HERE';
