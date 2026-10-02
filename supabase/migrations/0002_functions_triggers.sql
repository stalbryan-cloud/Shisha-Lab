-- SHISHA LAB — derived data: counters, ranking, trending, search vectors, rate limiting.

-- ───────────────────────── ranking ─────────────────────────
-- Bayesian average: (v*R + m*C) / (v + m)
--   R = mean rating of the recipe, v = its rating count,
--   C = site-wide mean rating, m = prior weight (ratings needed before the recipe's own mean dominates).
-- A single 5-star review therefore cannot beat a recipe with many 4.8s.
create or replace function recompute_recipe_rating(p_recipe uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v int; s int; mv int; ms int; dist int[]; c numeric; m constant numeric := 8;
begin
  select count(*), coalesce(sum(overall), 0),
         count(*) filter (where maker_status <> 'not_made'),
         coalesce(sum(overall) filter (where maker_status <> 'not_made'), 0),
         array[
           count(*) filter (where overall = 1), count(*) filter (where overall = 2),
           count(*) filter (where overall = 3), count(*) filter (where overall = 4),
           count(*) filter (where overall = 5)]
    into v, s, mv, ms, dist
    from recipe_reviews where recipe_id = p_recipe and moderation = 'visible';
  -- site-wide mean, itself shrunk toward 3.5 (weight 20) so a nearly empty site has a sane prior
  select (coalesce(sum(overall), 0) + 3.5 * 20) / (count(*) + 20) into c
    from recipe_reviews where moderation = 'visible';
  update recipes set
    review_count = v, rating_sum = s, maker_review_count = mv, maker_rating_sum = ms,
    rating_dist = dist,
    bayes_rating = case when v = 0 then 0 else round((v * (s::numeric / v) + m * c) / (v + m), 3) end
  where id = p_recipe;
end $$;

create or replace function trg_reviews_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_recipe_rating(coalesce(new.recipe_id, old.recipe_id));
  if tg_op = 'INSERT' then
    insert into recipe_events (recipe_id, kind, weight) values (new.recipe_id, 'review', 3);
  end if;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on recipe_reviews
  for each row execute function trg_reviews_rating();

-- ───────────────────────── generic counters ─────────────────────────
create or replace function trg_bump_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare col text := tg_argv[0]; kind text := tg_argv[1]; w numeric := coalesce(tg_argv[2], '1')::numeric;
        rid uuid; delta int;
begin
  rid := coalesce(new.recipe_id, old.recipe_id);
  delta := case tg_op when 'INSERT' then 1 else -1 end;
  execute format('update recipes set %I = greatest(%I + $1, 0) where id = $2', col, col) using delta, rid;
  if tg_op = 'INSERT' and kind is not null then
    insert into recipe_events (recipe_id, kind, weight) values (rid, kind, w);
  end if;
  return null;
end $$;
create trigger likes_counter after insert or delete on recipe_likes
  for each row execute function trg_bump_counter('like_count', 'like', '1');
create trigger saves_counter after insert or delete on recipe_saves
  for each row execute function trg_bump_counter('save_count', 'save', '2');
create trigger made_counter after insert or delete on recipe_experiments
  for each row execute function trg_bump_counter('made_count', 'made', '4');
create trigger comments_counter after insert or delete on comments
  for each row execute function trg_bump_counter('comment_count', 'comment', '1.5');

-- Public view counter: one aggregated row per recipe/day, no user identity stored.
create or replace function record_recipe_view(p_recipe uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into recipe_view_daily (recipe_id, day, views) values (p_recipe, current_date, 1)
  on conflict (recipe_id, day) do update set views = recipe_view_daily.views + 1;
  update recipes set view_count = view_count + 1 where id = p_recipe;
end $$;

-- Forum counters
create or replace function trg_forum_post_counter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update forum_topics set reply_count = reply_count + 1, last_activity_at = now() where id = new.topic_id;
  else
    update forum_topics set reply_count = greatest(reply_count - 1, 0) where id = old.topic_id;
  end if;
  return null;
end $$;
create trigger forum_post_counter after insert or delete on forum_posts
  for each row execute function trg_forum_post_counter();

create or replace function trg_vote_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int := case tg_op when 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'comment_votes' then
    update comments set upvotes = greatest(upvotes + d, 0) where id = coalesce(new.comment_id, old.comment_id);
  else
    if coalesce(new.topic_id, old.topic_id) is not null then
      update forum_topics set upvotes = greatest(upvotes + d, 0) where id = coalesce(new.topic_id, old.topic_id);
    else
      update forum_posts set upvotes = greatest(upvotes + d, 0) where id = coalesce(new.post_id, old.post_id);
    end if;
  end if;
  return null;
end $$;
create trigger comment_votes_counter after insert or delete on comment_votes
  for each row execute function trg_vote_counter();
create trigger forum_votes_counter after insert or delete on forum_votes
  for each row execute function trg_vote_counter();

-- ───────────────────────── trending ─────────────────────────
-- score = sum over events in window of weight * 0.5^(age_hours / half_life_hours)
--       + views_in_window * 0.05 (with the same decay on a per-day basis)
--       multiplied by a quality factor (0.8 + 0.4 * bayes_rating/5)
-- half-life scales with the window: 12h (day), 3d (week), 10d (month), 90d (year), 365d (all)
create or replace function trending_window_hours(p_window text) returns numeric
language sql immutable as $$
  select case p_window when 'day' then 24 when 'week' then 168 when 'month' then 720
                       when 'year' then 8760 else null end
$$;
create or replace function trending_half_life_hours(p_window text) returns numeric
language sql immutable as $$
  select case p_window when 'day' then 12 when 'week' then 72 when 'month' then 240
                       when 'year' then 2160 else 8760 end
$$;

create or replace function trending_recipes(p_window text default 'week', p_limit int default 12, p_offset int default 0)
returns table (recipe_id uuid, score numeric)
language sql stable security definer set search_path = public as $$
  with params as (
    select trending_window_hours(p_window) as win, trending_half_life_hours(p_window) as hl
  ),
  ev as (
    select e.recipe_id,
           sum(e.weight * power(0.5, extract(epoch from (now() - e.created_at)) / 3600.0 / (select hl from params))) as s
    from recipe_events e, params
    where params.win is null or e.created_at > now() - make_interval(hours => params.win::int)
    group by e.recipe_id
  ),
  vw as (
    select v.recipe_id,
           sum(v.views * 0.05 * power(0.5, (current_date - v.day) * 24.0 / (select hl from params))) as s
    from recipe_view_daily v, params
    where params.win is null or v.day > current_date - (params.win / 24)::int
    group by v.recipe_id
  )
  select r.id,
         round(((coalesce(ev.s, 0) + coalesce(vw.s, 0)) * (0.8 + 0.4 * r.bayes_rating / 5.0))::numeric, 4)
  from recipes r
  left join ev on ev.recipe_id = r.id
  left join vw on vw.recipe_id = r.id
  where r.status = 'published' and r.visibility = 'public' and r.moderation = 'visible'
    and (coalesce(ev.s, 0) + coalesce(vw.s, 0)) > 0
  order by 2 desc, r.published_at desc
  limit p_limit offset p_offset
$$;

-- Cached all-time score on the row for cheap sorting in /recipes (refreshed by cron or on demand).
create or replace function refresh_trending_scores() returns void
language sql security definer set search_path = public as $$
  update recipes r set trending_score = coalesce(t.score, 0)
  from (select * from trending_recipes('week', 100000, 0)) t
  where t.recipe_id = r.id;
  update recipes set trending_score = 0
  where trending_score <> 0 and id not in (select recipe_id from trending_recipes('week', 100000, 0));
$$;

-- ───────────────────────── search vectors ─────────────────────────
create or replace function trg_recipe_tsv() returns trigger
language plpgsql set search_path = public as $$
declare aroma_text text;
begin
  select string_agg(coalesce(a.flavour_name, '') || ' ' || coalesce(a.brand, '') || ' ' || coalesce(a.concentrate_name, ''), ' ')
    into aroma_text from recipe_aromas a where a.recipe_id = new.id;
  new.search_tsv :=
    setweight(to_tsvector('simple', unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(aroma_text, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.short_description, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(concat_ws(' ', new.tobacco_brand, new.tobacco_product_name,
              new.tobacco_leaf_type, new.tobacco_variety, new.tobacco_origin, new.tobacco_leaf_family))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(new.long_description, ''))), 'D');
  return new;
end $$;
create trigger recipes_tsv before insert or update on recipes
  for each row execute function trg_recipe_tsv();

-- Aroma rows change after the recipe row: touch the recipe so its vector is rebuilt.
create or replace function trg_touch_recipe_for_tsv() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update recipes set updated_at = updated_at where id = coalesce(new.recipe_id, old.recipe_id);
  return null;
end $$;
create trigger recipe_aromas_touch after insert or update or delete on recipe_aromas
  for each row execute function trg_touch_recipe_for_tsv();

create or replace function trg_topic_tsv() returns trigger language plpgsql as $$
begin
  new.search_tsv := setweight(to_tsvector('simple', unaccent(coalesce(new.title, ''))), 'A')
                 || setweight(to_tsvector('simple', unaccent(coalesce(new.body, ''))), 'C');
  return new;
end $$;
create trigger forum_topics_tsv before insert or update of title, body on forum_topics
  for each row execute function trg_topic_tsv();
create or replace function trg_post_tsv() returns trigger language plpgsql as $$
begin
  new.search_tsv := to_tsvector('simple', unaccent(coalesce(new.body, '')));
  return new;
end $$;
create trigger forum_posts_tsv before insert or update of body on forum_posts
  for each row execute function trg_post_tsv();

-- ───────────────────────── unified search ─────────────────────────
-- Query terms are expanded through flavour_synonyms (VG / glycerol, cassis / blackcurrant) and categories
-- (citrus -> lemon, lime, orange ...). Synonyms are data, not UI code.
create or replace function expand_search_terms(q text) returns text[]
language sql stable set search_path = public as $$
  with words as (
    select unnest(regexp_split_to_array(trim(regexp_replace(lower(unaccent(q)), '[^[:alnum:][:space:]]', ' ', 'g')), '\s+')) w
  ),
  lex as (
    select lower(term) as term, flavour_id, category_id, concept from flavour_synonyms
    union all select lower(name), id, null::uuid, null from flavours where merged_into is null
    union all select lower(name), null::uuid, id, null from flavour_categories
  ),
  hits as (select w.w, l.flavour_id, l.category_id, l.concept from words w join lex l on l.term = w.w),
  expanded as (
    select w as x from words
    union select l2.term from hits h join lex l2
      on (h.flavour_id is not null and l2.flavour_id = h.flavour_id)
      or (h.concept is not null and l2.concept = h.concept)
      or (h.category_id is not null and l2.category_id = h.category_id)
    union select l3.term from hits h
      join flavour_category_links fcl on fcl.category_id = h.category_id
      join lex l3 on l3.flavour_id = fcl.flavour_id
  )
  select coalesce(array_agg(distinct x), '{}') from expanded where x <> '' and x !~ '\s'
$$;

-- AND across the words the user typed, OR across each word's synonyms; prefix matching on every term.
create or replace function build_tsquery(q text) returns tsquery
language sql stable set search_path = public as $$
  with words as (
    select w, ord from unnest(regexp_split_to_array(trim(regexp_replace(lower(unaccent(q)), '[^[:alnum:][:space:]]', ' ', 'g')), '\s+'))
      with ordinality t(w, ord) where w <> ''
  ),
  per_word as (
    select w.ord, array_agg(distinct x) as xs from words w, lateral unnest(expand_search_terms(w.w)) x group by w.ord
  )
  select to_tsquery('simple', string_agg('(' || (select string_agg(quote_literal(x) || ':*', ' | ') from unnest(xs) x) || ')', ' & ' order by ord))
  from per_word
$$;

-- Ranking: text relevance dominates (x10), plus quality, engagement and recency nudges.
create or replace function search_recipes(p_q text, p_limit int default 20, p_offset int default 0)
returns table (id uuid, rank real)
language sql stable security definer set search_path = public as $$
  with query as (select build_tsquery(p_q) as tsq)
  select r.id,
         (ts_rank_cd(r.search_tsv, query.tsq) * 10
          + r.bayes_rating / 5.0
          + ln(1 + r.like_count + r.save_count + 2 * r.made_count) * 0.1
          + 1.0 / (1 + extract(epoch from now() - r.published_at) / 86400 / 90))::real as rank
  from recipes r, query
  where query.tsq is not null
    and r.status = 'published' and r.visibility = 'public' and r.moderation = 'visible'
    and r.search_tsv @@ query.tsq
  order by 2 desc
  limit p_limit offset p_offset
$$;

-- Typo-tolerant autocomplete over flavours, aromas, tobaccos, brands, users, topics.
create or replace function search_autocomplete(p_q text, p_per_group int default 5)
returns table (kind text, label text, slug text, similarity real)
language sql stable security definer set search_path = public as $$
  (select 'flavour', f.name, f.slug, greatest(similarity(f.name, p_q), 0.0)::real
     from flavours f where f.merged_into is null and (f.name % p_q or f.name ilike p_q || '%')
     union all
     select 'flavour', f.name, f.slug, similarity(s.term, p_q)::real
     from flavour_synonyms s join flavours f on f.id = s.flavour_id
     where f.merged_into is null and (s.term % p_q or s.term ilike p_q || '%')
     order by 4 desc limit p_per_group)
  union all
  (select 'aroma', a.product_name, a.slug, similarity(a.product_name, p_q)::real
     from aromas a where a.product_name % p_q or a.product_name ilike '%' || p_q || '%'
     order by 4 desc limit p_per_group)
  union all
  (select 'tobacco', t.product_name, t.slug, similarity(t.product_name, p_q)::real
     from tobaccos t where t.product_name % p_q or t.product_name ilike '%' || p_q || '%'
     order by 4 desc limit p_per_group)
  union all
  (select 'user', p.username, p.username, similarity(p.username, p_q)::real
     from profiles p where not p.is_anonymized and (p.username % p_q or p.username ilike p_q || '%')
     order by 4 desc limit p_per_group)
  union all
  (select 'recipe', r.title, r.slug, similarity(r.title, p_q)::real
     from recipes r
     where r.status = 'published' and r.visibility = 'public' and r.moderation = 'visible'
       and (r.title % p_q or r.title ilike '%' || p_q || '%')
     order by 4 desc limit p_per_group)
  union all
  (select 'topic', t.title, t.slug, similarity(t.title, p_q)::real
     from forum_topics t
     where t.status in ('open', 'locked') and (t.title % p_q or t.title ilike '%' || p_q || '%')
     order by 4 desc limit p_per_group)
$$;

-- ───────────────────────── rate limiting ─────────────────────────
-- Returns true if the action is allowed, and records the hit. Called from server actions and from
-- RLS-guarded insert triggers for comments/posts so direct API calls are limited too.
create or replace function check_rate_limit(p_bucket text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then return false; end if;
  delete from rate_limits where hit_at < now() - interval '1 day';
  select count(*) into n from rate_limits
   where user_id = uid and bucket = p_bucket and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into rate_limits (user_id, bucket) values (uid, p_bucket);
  return true;
end $$;

create or replace function trg_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not check_rate_limit(tg_argv[0], tg_argv[1]::int, tg_argv[2]::int) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger comments_rl before insert on comments for each row execute function trg_rate_limit('comment', '10', '300');
create trigger forum_topics_rl before insert on forum_topics for each row execute function trg_rate_limit('topic', '5', '3600');
create trigger forum_posts_rl before insert on forum_posts for each row execute function trg_rate_limit('post', '15', '300');
create trigger reviews_rl before insert on recipe_reviews for each row execute function trg_rate_limit('review', '10', '3600');
create trigger reports_rl before insert on reports for each row execute function trg_rate_limit('report', '10', '3600');
create trigger experiments_rl before insert on recipe_experiments for each row execute function trg_rate_limit('experiment', '10', '3600');

-- ───────────────────────── notifications ─────────────────────────
create or replace function notify(p_user uuid, p_actor uuid, p_type notification_type,
                                  p_recipe uuid default null, p_topic uuid default null, p_comment uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare prefs jsonb;
begin
  if p_user is null or p_user = p_actor then return; end if;
  select notification_prefs into prefs from profiles where id = p_user;
  if coalesce((prefs ->> p_type::text)::boolean, true) is false then return; end if;
  insert into notifications (user_id, actor_id, type, recipe_id, topic_id, comment_id)
  values (p_user, p_actor, p_type, p_recipe, p_topic, p_comment);
end $$;

create or replace function trg_notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare parent_author uuid; creator uuid;
begin
  select creator_id into creator from recipes where id = new.recipe_id;
  if new.parent_id is not null then
    select user_id into parent_author from comments where id = new.parent_id;
    perform notify(parent_author, new.user_id, 'comment_reply', new.recipe_id, null, new.id);
  end if;
  if creator is distinct from parent_author then
    perform notify(creator, new.user_id, 'recipe_commented', new.recipe_id, null, new.id);
  end if;
  return null;
end $$;
create trigger comments_notify after insert on comments for each row execute function trg_notify_comment();

create or replace function trg_notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify((select creator_id from recipes where id = new.recipe_id), new.user_id, 'recipe_reviewed', new.recipe_id);
  return null;
end $$;
create trigger reviews_notify after insert on recipe_reviews for each row execute function trg_notify_review();

create or replace function trg_notify_made() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify((select creator_id from recipes where id = new.recipe_id), new.user_id, 'recipe_made', new.recipe_id);
  return null;
end $$;
create trigger experiments_notify after insert on recipe_experiments for each row execute function trg_notify_made();

create or replace function trg_notify_forum_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from forum_topics where id = new.topic_id;
  perform notify(author, new.author_id, 'topic_reply', null, new.topic_id);
  insert into notifications (user_id, actor_id, type, topic_id)
  select f.user_id, new.author_id, 'topic_reply', new.topic_id
  from forum_follows f where f.topic_id = new.topic_id and f.user_id <> coalesce(new.author_id, f.user_id)
    and f.user_id is distinct from author;
  return null;
end $$;
create trigger forum_posts_notify after insert on forum_posts for each row execute function trg_notify_forum_post();

-- Saved-recipe watchers are told about a new published version.
create or replace function trg_notify_new_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.version_major <> 1 or new.version_minor <> 0 then
    insert into notifications (user_id, actor_id, type, recipe_id)
    select s.user_id, new.created_by, 'saved_recipe_new_version', new.recipe_id
    from recipe_saves s where s.recipe_id = new.recipe_id and s.user_id is distinct from new.created_by;
  end if;
  return null;
end $$;
create trigger versions_notify after insert on recipe_versions for each row execute function trg_notify_new_version();
