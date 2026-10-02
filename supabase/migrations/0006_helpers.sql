-- SHISHA LAB — small SECURITY DEFINER helpers the app needs (mentions, staff badges, discussion hand-off, report queue).

set check_function_bodies = off;

-- Moderator/admin status is public (shown as a badge) but user_roles itself is not world-readable.
create or replace function staff_user_ids(p_ids uuid[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select user_id from user_roles where user_id = any (p_ids) and role in ('moderator', 'admin')
$$;

-- Creates 'mention' notifications. The caller must be the author of the referenced comment/post/topic.
create or replace function notify_mentions(p_usernames text[], p_recipe uuid default null, p_topic uuid default null,
                                           p_comment uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ok boolean := false;
begin
  if me is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if p_comment is not null then
    ok := exists (select 1 from comments where id = p_comment and user_id = me);
  elsif p_topic is not null then
    ok := exists (select 1 from forum_topics where id = p_topic and author_id = me)
       or exists (select 1 from forum_posts where topic_id = p_topic and author_id = me and created_at > now() - interval '5 minutes');
  end if;
  if not ok then raise exception 'forbidden' using errcode = '42501'; end if;
  perform notify(pr.id, me, 'mention', p_recipe, p_topic, p_comment)
  from profiles pr where pr.username = any (array(select lower(u) from unnest(p_usernames[1:10]) u)) and not pr.is_anonymized;
end $$;

-- "Continue this discussion in Community": one forum topic per comment thread root, linked back to the comment.
create or replace function continue_in_community(p_comment uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c comments; r recipes; tid uuid; tslug text; cat uuid; me uuid := auth.uid(); author_name text;
begin
  if me is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if is_suspended() then raise exception 'account suspended' using errcode = '42501'; end if;
  select * into c from comments where id = p_comment and moderation = 'visible';
  if not found or not can_view_recipe(c.recipe_id) then raise exception 'not found'; end if;
  if c.forum_topic_id is not null then
    return (select slug from forum_topics where id = c.forum_topic_id);
  end if;
  select * into r from recipes where id = c.recipe_id;
  select id into cat from forum_categories where slug = 'recipes-experiments' and not is_archived;
  if cat is null then select id into cat from forum_categories where not is_archived order by sort_order limit 1; end if;
  select coalesce(display_name, username) into author_name from profiles where id = c.user_id;
  tslug := lower(regexp_replace(left(r.title, 40), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into forum_topics (slug, category_id, author_id, title, body, recipe_id)
  values (tslug, cat, me, left('Discussion: ' || r.title, 160),
          'Continued from a comment thread on [' || r.title || '](/recipes/' || r.slug || ')' || E'\n\n' ||
          '> ' || replace(left(c.body, 600), E'\n', E'\n> ') || E'\n\n— ' || coalesce(author_name, 'a member'), r.id)
  returning id into tid;
  update comments set forum_topic_id = tid where id = p_comment;
  return tslug;
end $$;

-- Moderator report queue with a short preview of the reported content (polymorphic target).
create or replace function report_queue(p_status text default 'open', p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, target_type report_target, target_id uuid, reason report_reason, details text, status report_status,
  priority smallint, assigned_to uuid, moderator_notes text, resolution text, created_at timestamptz,
  reporter_username text, preview text, link text, target_user uuid, total bigint
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.priority, r.assigned_to, r.moderator_notes,
         r.resolution, r.created_at, rp.username,
         case r.target_type
           when 'recipe' then (select title from recipes where id = r.target_id)
           when 'comment' then (select left(body, 200) from comments where id = r.target_id)
           when 'review' then (select left(coalesce(body, 'Rating ' || overall || '★'), 200) from recipe_reviews where id = r.target_id)
           when 'experiment' then (select left(coalesce(notes, 'Experiment result'), 200) from recipe_experiments where id = r.target_id)
           when 'forum_topic' then (select title from forum_topics where id = r.target_id)
           when 'forum_post' then (select left(body, 200) from forum_posts where id = r.target_id)
           when 'profile' then (select username from profiles where id = r.target_id)
         end,
         case r.target_type
           when 'recipe' then (select '/recipes/' || slug from recipes where id = r.target_id)
           when 'comment' then (select '/recipes/' || rc.slug || '#comment-' || c.id from comments c join recipes rc on rc.id = c.recipe_id where c.id = r.target_id)
           when 'review' then (select '/recipes/' || rc.slug || '#reviews' from recipe_reviews rv join recipes rc on rc.id = rv.recipe_id where rv.id = r.target_id)
           when 'experiment' then (select '/recipes/' || rc.slug || '#community-results' from recipe_experiments e join recipes rc on rc.id = e.recipe_id where e.id = r.target_id)
           when 'forum_topic' then (select '/community/t/' || slug from forum_topics where id = r.target_id)
           when 'forum_post' then (select '/community/t/' || t.slug || '#post-' || p.id from forum_posts p join forum_topics t on t.id = p.topic_id where p.id = r.target_id)
           when 'profile' then (select '/u/' || username from profiles where id = r.target_id)
         end,
         case r.target_type
           when 'recipe' then (select creator_id from recipes where id = r.target_id)
           when 'comment' then (select user_id from comments where id = r.target_id)
           when 'review' then (select user_id from recipe_reviews where id = r.target_id)
           when 'experiment' then (select user_id from recipe_experiments where id = r.target_id)
           when 'forum_topic' then (select author_id from forum_topics where id = r.target_id)
           when 'forum_post' then (select author_id from forum_posts where id = r.target_id)
           when 'profile' then r.target_id
         end,
         count(*) over ()
  from reports r left join profiles rp on rp.id = r.reporter_id
  where p_status = 'all' or r.status::text = p_status
  order by (r.status in ('open', 'in_review')) desc, r.priority, r.created_at
  limit least(p_limit, 100) offset p_offset;
end $$;

-- Admin dashboard numbers (aggregate only).
create or replace function admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'recipes', (select count(*) from recipes),
    'published', (select count(*) from recipes where status = 'published'),
    'drafts', (select count(*) from recipes where status = 'draft'),
    'topics', (select count(*) from forum_topics),
    'posts', (select count(*) from forum_posts),
    'topics_7d', (select count(*) from forum_topics where created_at > now() - interval '7 days'),
    'comments', (select count(*) from comments),
    'reviews', (select count(*) from recipe_reviews),
    'open_reports', (select count(*) from reports where status in ('open', 'in_review')),
    'active_suspensions', (select count(*) from user_suspensions where lifted_at is null and (ends_at is null or ends_at > now())),
    'storage_objects', (select count(*) from storage.objects),
    'storage_bytes', coalesce((select sum(((metadata ->> 'size'))::bigint) from storage.objects where metadata ? 'size'), 0));
exception when undefined_column then
  return jsonb_build_object('users', (select count(*) from profiles), 'open_reports', (select count(*) from reports where status in ('open','in_review')));
end $$;

grant execute on function staff_user_ids(uuid[]) to anon, authenticated;
grant execute on function notify_mentions(text[], uuid, uuid, uuid), continue_in_community(uuid),
  report_queue(text, int, int), admin_dashboard() to authenticated;
