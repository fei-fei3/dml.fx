-- Migration v2.02: Store AI/Forecast responses + add RLS
-- Run this in Supabase SQL Editor

create table if not exists ai_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('insight', 'forecast')),
  pair text,                          -- only for forecasts
  input_summary jsonb,                -- what was sent to Claude
  response_text text not null,        -- Claude's full response
  mb_cost integer not null,           -- how much it cost
  created_at timestamptz default now()
);

create index if not exists ai_responses_user_idx on ai_responses(user_id);
create index if not exists ai_responses_type_idx on ai_responses(type);
create index if not exists ai_responses_created_idx on ai_responses(created_at desc);

alter table ai_responses enable row level security;

-- Users can see their own responses
create policy "users read own ai responses" on ai_responses for select
  using (auth.uid() = user_id);

-- Admins can see all responses
create policy "admins read all ai responses" on ai_responses for select
  using (is_admin());

-- Edge functions insert via service role, so no insert policy needed for users
-- But allow it for completeness
create policy "system insert ai responses" on ai_responses for insert
  with check (auth.uid() = user_id);
