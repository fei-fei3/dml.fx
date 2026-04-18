-- Migration: Add deactivation support to profiles
-- Run this in Supabase SQL Editor

alter table profiles add column if not exists deactivated boolean default false;
alter table profiles add column if not exists deactivated_at timestamptz;
alter table profiles add column if not exists deactivated_by uuid references auth.users(id);

-- Block deactivated users from inserting new trades or anything
-- (login is also blocked client-side after they sign in)
create or replace function check_active()
returns trigger language plpgsql security definer as $$
begin
  if exists (select 1 from profiles where id = auth.uid() and deactivated = true) then
    raise exception 'Account deactivated. Contact admin.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_deactivated_trades on trades;
create trigger block_deactivated_trades
  before insert or update on trades
  for each row execute function check_active();
