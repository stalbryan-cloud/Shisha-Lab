-- 0008: aggregate-only analytics for recipe creators. Returns daily view totals for the caller's OWN recipes only.
-- No viewer identities are stored anywhere, so none can be returned.
create or replace function creator_view_series(p_days int default 30)
returns table (recipe_id uuid, day date, views int)
language sql stable security definer set search_path = public as $$
  select v.recipe_id, v.day, v.views
  from recipe_view_daily v join recipes r on r.id = v.recipe_id
  where r.creator_id = auth.uid() and v.day >= current_date - least(greatest(p_days, 1), 365)
  order by v.day
$$;
revoke all on function creator_view_series(int) from public;
grant execute on function creator_view_series(int) to authenticated;
