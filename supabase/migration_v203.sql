-- Migration v2.03: Community stats aggregation function
-- Run in Supabase SQL Editor

-- Function: get anonymous community-wide trading stats
create or replace function get_community_stats()
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_traders', (select count(distinct user_id) from trades where pnl is not null),
    'total_trades', (select count(*) from trades where pnl is not null),
    'community_win_rate', (
      select round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1)
      from trades where pnl is not null
    ),
    'community_avg_pnl', (select round(avg(pnl)::numeric, 2) from trades where pnl is not null),
    'community_profit_factor', (
      select round(
        (coalesce(sum(pnl) filter (where pnl > 0), 0)::numeric /
        nullif(abs(coalesce(sum(pnl) filter (where pnl < 0), 0)), 0))::numeric
      , 2)
      from trades where pnl is not null
    ),
    'by_pair', (
      select coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb) from (
        select pair,
          count(*) as trades,
          count(distinct user_id) as traders,
          round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1) as win_rate,
          round(avg(pnl)::numeric, 2) as avg_pnl,
          round(sum(pnl)::numeric, 2) as total_pnl
        from trades where pnl is not null
        group by pair order by count(*) desc
      ) sub
    ),
    'by_strategy', (
      select coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb) from (
        select strategy,
          count(*) as trades,
          count(distinct user_id) as traders,
          round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1) as win_rate,
          round(avg(pnl)::numeric, 2) as avg_pnl
        from trades where pnl is not null and strategy is not null
        group by strategy order by count(*) desc
      ) sub
    ),
    'by_emotion', (
      select coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb) from (
        select emotion,
          count(*) as trades,
          round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1) as win_rate,
          round(avg(pnl)::numeric, 2) as avg_pnl
        from trades where pnl is not null and emotion is not null
        group by emotion order by count(*) desc
      ) sub
    ),
    'by_direction', (
      select coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb) from (
        select direction,
          count(*) as trades,
          round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1) as win_rate,
          round(sum(pnl)::numeric, 2) as total_pnl
        from trades where pnl is not null
        group by direction
      ) sub
    ),
    'by_day', (
      select coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb) from (
        select extract(dow from date)::int as day_num,
          case extract(dow from date)::int
            when 0 then 'SUN' when 1 then 'MON' when 2 then 'TUE'
            when 3 then 'WED' when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT'
          end as day_name,
          count(*) as trades,
          round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1) as win_rate,
          round(avg(pnl)::numeric, 2) as avg_pnl
        from trades where pnl is not null and date is not null
        group by extract(dow from date)::int order by extract(dow from date)::int
      ) sub
    ),
    'top_pairs_this_month', (
      select coalesce(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb) from (
        select pair,
          count(*) as trades,
          round((count(*) filter (where pnl > 0))::numeric / nullif(count(*), 0) * 100, 1) as win_rate
        from trades
        where pnl is not null and to_char(date, 'YYYY-MM') = to_char(now(), 'YYYY-MM')
        group by pair order by count(*) desc limit 5
      ) sub
    ),
    'recent_community_notes', (
      select coalesce(jsonb_agg(notes), '[]'::jsonb) from (
        select notes from trades
        where notes is not null and notes != '' and pnl is not null
        order by created_at desc limit 20
      ) sub
    )
  ) into result;
  return result;
end;
$$;
