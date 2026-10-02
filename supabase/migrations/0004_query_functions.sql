-- SHISHA LAB — read-side query functions used by the app (SECURITY INVOKER: RLS still applies).
-- Filtering, sorting and pagination happen in the database so the client never loads large lists.

set check_function_bodies = off;

create index if not exists recipe_aromas_flavour_recipe on recipe_aromas (flavour_id, recipe_id);
create index if not exists recipe_base_ingredients_category on recipe_base_ingredients (category, recipe_id);
create index if not exists recipes_rest on recipes ((coalesce(recommended_rest_hours, initial_rest_hours)));
create index if not exists forum_topics_activity on forum_topics (last_activity_at desc) where status in ('open', 'locked');

create or replace function list_recipes(
  p_q text default null, p_family text[] default null, p_leaf text[] default null, p_brand text[] default null,
  p_origin text[] default null, p_washed boolean default null, p_sweetener text[] default null,
  p_aroma_brand text[] default null, p_flavour text[] default null, p_profile text[] default null,
  p_strength int[] default null, p_intensity int[] default null, p_sweetness int[] default null,
  p_rest_min int default null, p_rest_max int default null, p_min_rating numeric default null,
  p_min_reviews int default null, p_since timestamptz default null, p_tested boolean default false,
  p_have text[] default null, p_sort text default 'trending', p_limit int default 24, p_offset int default 0,
  p_creator uuid default null
) returns table (id uuid, total bigint)
language sql stable set search_path = public as $$
  with q as (select case when coalesce(trim(p_q), '') = '' then null else build_tsquery(p_q) end as tsq)
  select r.id, count(*) over () as total
  from recipes r, q
  where r.status = 'published' and r.visibility = 'public' and r.moderation = 'visible'
    and (p_creator is null or r.creator_id = p_creator)
    and (q.tsq is null or r.search_tsv @@ q.tsq)
    and (p_family is null or r.tobacco_leaf_family = any (p_family))
    and (p_leaf is null or exists (select 1 from tobacco_leaf_types l
          where l.slug = any (p_leaf) and lower(l.name) = lower(r.tobacco_leaf_type)))
    and (p_brand is null or exists (select 1 from tobacco_brands b
          where b.slug = any (p_brand) and (lower(b.name) = lower(r.tobacco_brand)
             or exists (select 1 from tobaccos t where t.id = r.tobacco_id and t.brand_id = b.id))))
    and (p_origin is null or lower(r.tobacco_origin) = any (select lower(x) from unnest(p_origin) x))
    and (p_washed is null or r.washed = p_washed)
    and (p_sweetener is null or exists (select 1 from recipe_base_ingredients i
          where i.recipe_id = r.id and i.category::text = any (p_sweetener)))
    and (p_aroma_brand is null or exists (select 1 from recipe_aromas a
          join aromas am on am.id = a.aroma_id join aroma_brands ab on ab.id = am.brand_id
          where a.recipe_id = r.id and ab.slug = any (p_aroma_brand)))
    and (p_flavour is null or (select count(distinct f.slug) from recipe_aromas a
          join flavours f on f.id = a.flavour_id where a.recipe_id = r.id and f.slug = any (p_flavour)) = cardinality(p_flavour))
    and (p_profile is null or (select count(distinct fp.slug) from recipe_flavour_profiles rp
          join flavour_profiles fp on fp.id = rp.profile_id where rp.recipe_id = r.id and fp.slug = any (p_profile)) = cardinality(p_profile))
    and (p_strength is null or r.creator_strength between p_strength[1] and p_strength[2])
    and (p_intensity is null or r.creator_flavour_intensity between p_intensity[1] and p_intensity[2])
    and (p_sweetness is null or r.creator_sweetness between p_sweetness[1] and p_sweetness[2])
    and (p_rest_min is null or coalesce(r.recommended_rest_hours, r.initial_rest_hours) >= p_rest_min)
    and (p_rest_max is null or coalesce(r.recommended_rest_hours, r.initial_rest_hours) <= p_rest_max)
    and (p_min_rating is null or (r.review_count > 0 and r.rating_sum::numeric / r.review_count >= p_min_rating))
    and (p_min_reviews is null or r.review_count >= p_min_reviews)
    and (p_since is null or r.published_at >= p_since)
    and (not coalesce(p_tested, false) or r.made_count >= 3)
    -- "recipes I can make": every aroma in the recipe must be one of the user's selected aromas
    and (p_have is null or (
          exists (select 1 from recipe_aromas a where a.recipe_id = r.id)
          and not exists (select 1 from recipe_aromas a left join aromas am on am.id = a.aroma_id
                          where a.recipe_id = r.id and (am.slug is null or am.slug <> all (p_have)))))
  order by
    case p_sort
      when 'relevance' then ts_rank_cd(r.search_tsv, q.tsq) * 10 + r.bayes_rating / 5.0
      when 'trending' then r.trending_score
      when 'rating' then r.bayes_rating
      when 'rated' then r.review_count
      when 'made' then r.made_count
      when 'saved' then r.save_count
      when 'discussed' then r.comment_count + r.review_count
      else null end desc nulls last,
    case when p_sort = 'oldest' then r.published_at end asc,
    r.published_at desc, r.id
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
$$;

create or replace function similar_recipes(p_recipe uuid, p_limit int default 6)
returns table (id uuid, score numeric)
language sql stable set search_path = public as $$
  select o.id,
    (3 * coalesce((select count(*) from recipe_aromas a1 join recipe_aromas a2 on a2.flavour_id = a1.flavour_id
                    where a1.recipe_id = p_recipe and a2.recipe_id = o.id and a1.flavour_id is not null), 0)
   + 2 * coalesce((select count(*) from recipe_flavour_profiles p1 join recipe_flavour_profiles p2 on p2.profile_id = p1.profile_id
                    where p1.recipe_id = p_recipe and p2.recipe_id = o.id), 0)
   + 1 * coalesce((select count(*) from recipe_tags t1 join recipe_tags t2 on t2.tag_id = t1.tag_id
                    where t1.recipe_id = p_recipe and t2.recipe_id = o.id), 0)
   + case when o.tobacco_leaf_family = r.tobacco_leaf_family then 1 else 0 end
   + o.bayes_rating / 10.0)::numeric as score
  from recipes r join recipes o on o.id <> r.id
  where r.id = p_recipe and o.status = 'published' and o.visibility = 'public' and o.moderation = 'visible'
  order by 2 desc, o.published_at desc
  limit least(p_limit, 24)
$$;

create or replace function community_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'recipes', (select count(*) from recipes where status = 'published' and visibility = 'public' and moderation = 'visible'),
    'experiments', (select count(*) from recipe_experiments where moderation = 'visible' and visibility = 'public'),
    'members', (select count(*) from profiles where not is_anonymized),
    'ratings', (select count(*) from recipe_reviews where moderation = 'visible'),
    'discussions', (select count(*) from forum_topics where status in ('open', 'locked')),
    'recreations', (select count(distinct (recipe_id, user_id)) from recipe_experiments where moderation = 'visible'))
$$;

create or replace function popular_profiles(p_limit int default 8)
returns table (slug text, name text, recipe_count bigint)
language sql stable security definer set search_path = public as $$
  select fp.slug, fp.name, count(r.id)
  from flavour_profiles fp
  join recipe_flavour_profiles rp on rp.profile_id = fp.id
  join recipes r on r.id = rp.recipe_id and r.status = 'published' and r.visibility = 'public' and r.moderation = 'visible'
  group by fp.slug, fp.name, fp.sort_order
  order by count(r.id) desc, fp.sort_order
  limit p_limit
$$;

-- Faceted counts for /explore and the filter UI. Only counts public, visible recipes.
create or replace function explore_facets() returns jsonb
language sql stable security definer set search_path = public as $$
  with pub as (select * from recipes where status = 'published' and visibility = 'public' and moderation = 'visible')
  select jsonb_build_object(
    'flavours', coalesce((select jsonb_agg(x order by (x->>'count')::int desc, x->>'name') from (
        select jsonb_build_object('slug', f.slug, 'name', f.name, 'count', count(distinct a.recipe_id)) x
        from flavours f left join recipe_aromas a on a.flavour_id = f.id and a.recipe_id in (select id from pub)
        where f.merged_into is null group by f.slug, f.name) s), '[]'),
    'aroma_brands', coalesce((select jsonb_agg(x order by (x->>'count')::int desc, x->>'name') from (
        select jsonb_build_object('slug', b.slug, 'name', b.name, 'count', count(distinct a.recipe_id)) x
        from aroma_brands b left join aromas am on am.brand_id = b.id
        left join recipe_aromas a on a.aroma_id = am.id and a.recipe_id in (select id from pub)
        group by b.slug, b.name) s), '[]'),
    'leaf_types', coalesce((select jsonb_agg(x order by (x->>'count')::int desc, x->>'name') from (
        select jsonb_build_object('slug', l.slug, 'name', l.name, 'family', l.family, 'count', count(p.id)) x
        from tobacco_leaf_types l left join pub p on lower(p.tobacco_leaf_type) = lower(l.name)
        group by l.slug, l.name, l.family) s), '[]'),
    'origins', coalesce((select jsonb_agg(x order by (x->>'count')::int desc, x->>'name') from (
        select jsonb_build_object('name', initcap(tobacco_origin), 'count', count(*)) x
        from pub where tobacco_origin is not null group by initcap(tobacco_origin), tobacco_origin) s), '[]'),
    'profiles', coalesce((select jsonb_agg(x order by (x->>'sort')::int) from (
        select jsonb_build_object('slug', fp.slug, 'name', fp.name, 'sort', fp.sort_order, 'count', count(p.id)) x
        from flavour_profiles fp left join recipe_flavour_profiles rp on rp.profile_id = fp.id
        left join pub p on p.id = rp.recipe_id group by fp.slug, fp.name, fp.sort_order) s), '[]'))
$$;

-- Forum listing with sort + time range.
create or replace function list_topics(
  p_category uuid default null, p_sort text default 'latest', p_range text default 'all',
  p_q text default null, p_tag text default null, p_author uuid default null, p_limit int default 20, p_offset int default 0
) returns table (id uuid, total bigint)
language sql stable set search_path = public as $$
  with q as (select case when coalesce(trim(p_q), '') = '' then null else build_tsquery(p_q) end as tsq),
  since as (select case p_range when 'day' then now() - interval '1 day' when 'week' then now() - interval '7 days'
                               when 'month' then now() - interval '30 days' when 'year' then now() - interval '365 days' end as ts)
  select t.id, count(*) over () as total
  from forum_topics t, q, since
  where t.status in ('open', 'locked', 'archived')
    and (p_category is null or t.category_id = p_category)
    and (p_author is null or t.author_id = p_author)
    and (since.ts is null or t.last_activity_at >= since.ts or t.created_at >= since.ts)
    and (p_sort <> 'unanswered' or t.reply_count = 0)
    and (p_tag is null or exists (select 1 from forum_topic_tags ft join tags g on g.id = ft.tag_id where ft.topic_id = t.id and g.slug = p_tag))
    and (q.tsq is null
         or t.search_tsv @@ q.tsq
         or exists (select 1 from forum_posts p where p.topic_id = t.id and p.moderation = 'visible' and p.search_tsv @@ q.tsq)
         or exists (select 1 from forum_topic_tags ft join tags g on g.id = ft.tag_id where ft.topic_id = t.id and g.slug = lower(trim(p_q)))
         or exists (select 1 from profiles pr where pr.id = t.author_id and pr.username = lower(trim(p_q))))
  order by t.is_pinned desc,
    case p_sort
      when 'popular' then (t.upvotes * 3 + t.reply_count * 2 + t.views * 0.1)
      when 'views' then t.views
      when 'replies' then t.reply_count
      else null end desc nulls last,
    t.last_activity_at desc, t.id
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create or replace function record_topic_view(p_topic uuid) returns void
language sql security definer set search_path = public as $$
  update forum_topics set views = views + 1 where id = p_topic
$$;

grant execute on function list_recipes(text, text[], text[], text[], text[], boolean, text[], text[], text[], text[],
  int[], int[], int[], int, int, numeric, int, timestamptz, boolean, text[], text, int, int, uuid) to anon, authenticated;
grant execute on function similar_recipes(uuid, int), community_stats(), popular_profiles(int), explore_facets(),
  list_topics(uuid, text, text, text, text, uuid, int, int), record_topic_view(uuid) to anon, authenticated;
