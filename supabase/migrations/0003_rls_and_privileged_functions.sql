-- SHISHA LAB — authorization: grants, Row Level Security, privileged functions, storage policies.
-- Principle: clients get the minimum column/row access; anything privileged (roles, moderation state,
-- featuring, publishing, counters) goes through SECURITY DEFINER functions that re-check the caller.

set check_function_bodies = off;

-- ───────────────────────── visibility helper ─────────────────────────
create or replace function can_view_recipe(p_recipe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from recipes r
    where r.id = p_recipe
      and ( r.creator_id = auth.uid()
            or is_moderator()
            or (r.status = 'published' and r.visibility in ('public', 'unlisted') and r.moderation = 'visible') )
  )
$$;
create or replace function owns_recipe(p_recipe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from recipes r where r.id = p_recipe and r.creator_id = auth.uid())
$$;

-- ───────────────────────── base grants ─────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
-- internal tables are never readable through the API
revoke select on rate_limits, recipe_events from anon, authenticated;
-- anonymous visitors only read; everything below is for signed-in users
grant insert, delete on recipe_likes, recipe_saves, collection_recipes, comment_votes,
      forum_bookmarks, forum_follows, recipe_tags, recipe_flavour_profiles to authenticated;
grant insert, delete on forum_votes to authenticated;
grant insert, update, delete on collections, recipe_drafts, recipe_base_ingredients, recipe_aromas,
      recipe_steps, recipe_sources, experiment_changes, experiment_images to authenticated;
grant insert, delete on tags to authenticated;
grant insert on reports to authenticated;

-- ───────────────────────── profiles ─────────────────────────
alter table profiles enable row level security;
create policy profiles_read on profiles for select using (true);
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid());
grant update (username, display_name, bio, avatar_path, location, website, social_links, experience_level,
              pinned_recipe_id, show_saved, show_likes, show_location, notification_prefs, age_acknowledged_at)
  on profiles to authenticated;

alter table user_roles enable row level security;
create policy user_roles_read on user_roles for select using (user_id = auth.uid() or is_moderator());
-- no write policies: roles change only through admin_set_role()

-- ───────────────────────── taxonomy / ingredient DB (read-all, staff-write) ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['flavour_categories','flavours','flavour_category_links','flavour_synonyms',
    'flavour_profiles','tobacco_brands','tobacco_leaf_types','tobaccos','aroma_brands','aromas',
    'aroma_flavours','sweeteners','ingredients','forum_categories','forum_category_moderators','site_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (true)', t || '_read', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin_write', t);
    execute format('grant insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
-- moderators may curate the ingredient database as well
do $$
declare t text;
begin
  foreach t in array array['tobacco_brands','tobaccos','aroma_brands','aromas','aroma_flavours','flavours',
                           'flavour_synonyms','flavour_category_links']
  loop
    execute format('create policy %I on %I for all using (is_moderator()) with check (is_moderator())', t || '_mod_write', t);
  end loop;
end $$;

alter table tags enable row level security;
create policy tags_read on tags for select using (true);
create policy tags_insert on tags for insert to authenticated with check (not is_suspended());
create policy tags_admin_delete on tags for delete using (is_admin());

-- ───────────────────────── recipes ─────────────────────────
alter table recipes enable row level security;
create policy recipes_read on recipes for select using (
  creator_id = auth.uid() or is_moderator()
  or (status = 'published' and visibility in ('public', 'unlisted') and moderation = 'visible')
);
create policy recipes_insert on recipes for insert to authenticated
  with check (creator_id = auth.uid() and status = 'draft' and not is_suspended());
create policy recipes_update_own on recipes for update to authenticated
  using (creator_id = auth.uid() and not is_suspended()) with check (creator_id = auth.uid());
create policy recipes_delete_own_draft on recipes for delete to authenticated
  using ((creator_id = auth.uid() and status = 'draft') or is_admin());
grant insert (slug, creator_id, title, short_description, long_description, cover_image_path, status, visibility,
  target_batch_weight, actual_final_weight, units, tobacco_id, tobacco_weight, tobacco_brand, tobacco_product_name,
  tobacco_leaf_family, tobacco_leaf_type, tobacco_variety, tobacco_origin, tobacco_cut, tobacco_strength_category,
  washed, wash_method, wash_duration_minutes, drying_method, drying_duration_minutes, tobacco_notes,
  initial_rest_hours, recommended_rest_hours, rest_temperature_c, mixing_schedule, storage_method,
  creator_strength, creator_sweetness, creator_flavour_intensity, creator_cooling, creator_cloud,
  creator_heat_tolerance, difficulty, equipment, creator_notes, completeness) on recipes to authenticated;
grant update (title, short_description, long_description, cover_image_path, status, visibility,
  target_batch_weight, actual_final_weight, units, tobacco_id, tobacco_weight, tobacco_brand, tobacco_product_name,
  tobacco_leaf_family, tobacco_leaf_type, tobacco_variety, tobacco_origin, tobacco_cut, tobacco_strength_category,
  washed, wash_method, wash_duration_minutes, drying_method, drying_duration_minutes, tobacco_notes,
  initial_rest_hours, recommended_rest_hours, rest_temperature_c, mixing_schedule, storage_method,
  creator_strength, creator_sweetness, creator_flavour_intensity, creator_cooling, creator_cloud,
  creator_heat_tolerance, difficulty, equipment, creator_notes, completeness) on recipes to authenticated;
grant delete on recipes to authenticated;

-- Publishing is only possible through publish_recipe(); owners may archive / un-archive freely.
create or replace function trg_guard_recipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status = 'published' and old.status <> 'published'
     and coalesce(current_setting('app.publishing', true), '') <> '1' then
    raise exception 'use publish_recipe()' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'draft' then
    raise exception 'published recipes can only be archived, not reverted to draft' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger recipes_guard before update on recipes for each row execute function trg_guard_recipe();

-- Child tables: visible with the recipe, writable only by its owner.
do $$
declare t text;
begin
  foreach t in array array['recipe_base_ingredients','recipe_aromas','recipe_steps','recipe_sources',
                           'recipe_tags','recipe_flavour_profiles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (can_view_recipe(recipe_id))', t || '_read', t);
    execute format('create policy %I on %I for insert to authenticated with check (owns_recipe(recipe_id) and not is_suspended())', t || '_ins', t);
    if t not in ('recipe_tags','recipe_flavour_profiles') then
      execute format('create policy %I on %I for update to authenticated using (owns_recipe(recipe_id)) with check (owns_recipe(recipe_id))', t || '_upd', t);
    end if;
    execute format('create policy %I on %I for delete to authenticated using (owns_recipe(recipe_id))', t || '_del', t);
  end loop;
end $$;

alter table recipe_versions enable row level security;
create policy recipe_versions_read on recipe_versions for select using (can_view_recipe(recipe_id));
-- no client write policies: rows are created by publish_recipe()

alter table recipe_drafts enable row level security;
create policy recipe_drafts_own on recipe_drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── engagement ─────────────────────────
alter table recipe_likes enable row level security;
create policy likes_read on recipe_likes for select using (true);
create policy likes_ins on recipe_likes for insert to authenticated
  with check (user_id = auth.uid() and can_view_recipe(recipe_id) and not is_suspended());
create policy likes_del on recipe_likes for delete to authenticated using (user_id = auth.uid());

alter table recipe_saves enable row level security;
create policy saves_read_own on recipe_saves for select using (user_id = auth.uid());
create policy saves_ins on recipe_saves for insert to authenticated
  with check (user_id = auth.uid() and can_view_recipe(recipe_id));
create policy saves_del on recipe_saves for delete to authenticated using (user_id = auth.uid());

alter table collections enable row level security;
create policy collections_own on collections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table collection_recipes enable row level security;
create policy collection_recipes_own on collection_recipes for all to authenticated
  using (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
              and can_view_recipe(recipe_id));

alter table recipe_view_daily enable row level security;   -- no policies: definer functions only
alter table recipe_events enable row level security;
alter table rate_limits enable row level security;

-- ───────────────────────── reviews ─────────────────────────
alter table recipe_reviews enable row level security;
create policy reviews_read on recipe_reviews for select using (
  (moderation = 'visible' and can_view_recipe(recipe_id)) or user_id = auth.uid() or is_moderator()
);
create policy reviews_insert on recipe_reviews for insert to authenticated with check (
  user_id = auth.uid() and can_view_recipe(recipe_id) and not is_suspended()
  and not owns_recipe(recipe_id)          -- creators cannot rate their own recipe
);
create policy reviews_update_own on recipe_reviews for update to authenticated
  using (user_id = auth.uid() and not is_suspended()) with check (user_id = auth.uid());
create policy reviews_delete_own on recipe_reviews for delete to authenticated using (user_id = auth.uid());
grant insert (recipe_id, user_id, version_major, version_minor, maker_status, overall, flavour, balance, ease, cloud, heat_tolerance, body)
  on recipe_reviews to authenticated;
grant update (maker_status, overall, flavour, balance, ease, cloud, heat_tolerance, body, version_major, version_minor)
  on recipe_reviews to authenticated;
grant delete on recipe_reviews to authenticated;

-- ───────────────────────── experiments ─────────────────────────
-- 'followers' visibility is stored for the future follow feature; until follows exist it behaves like private.
alter table recipe_experiments enable row level security;
create policy experiments_read on recipe_experiments for select using (
  user_id = auth.uid() or is_moderator()
  or (visibility = 'public' and moderation = 'visible' and can_view_recipe(recipe_id))
);
create policy experiments_insert on recipe_experiments for insert to authenticated
  with check (user_id = auth.uid() and can_view_recipe(recipe_id) and not is_suspended());
create policy experiments_update_own on recipe_experiments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy experiments_delete_own on recipe_experiments for delete to authenticated using (user_id = auth.uid());
grant insert (recipe_id, user_id, version_major, version_minor, made_on, batch_size, followed_exactly, overall,
  flavour_accuracy, flavour_intensity, sweetness, strength, cloud_output, heat_tolerance, would_make_again, notes, visibility)
  on recipe_experiments to authenticated;
grant update (made_on, batch_size, followed_exactly, overall, flavour_accuracy, flavour_intensity, sweetness,
  strength, cloud_output, heat_tolerance, would_make_again, notes, visibility) on recipe_experiments to authenticated;
grant delete on recipe_experiments to authenticated;

alter table experiment_changes enable row level security;
alter table experiment_images enable row level security;
create policy exp_changes_read on experiment_changes for select using (
  exists (select 1 from recipe_experiments e where e.id = experiment_id));   -- inherits experiments_read
create policy exp_changes_write on experiment_changes for all to authenticated
  using (exists (select 1 from recipe_experiments e where e.id = experiment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from recipe_experiments e where e.id = experiment_id and e.user_id = auth.uid()));
create policy exp_images_read on experiment_images for select using (
  exists (select 1 from recipe_experiments e where e.id = experiment_id));
create policy exp_images_write on experiment_images for all to authenticated
  using (exists (select 1 from recipe_experiments e where e.id = experiment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from recipe_experiments e where e.id = experiment_id and e.user_id = auth.uid()));

-- ───────────────────────── comments ─────────────────────────
-- Depth is derived server-side so a client cannot post at an arbitrary level.
create or replace function trg_comment_depth() returns trigger
language plpgsql security definer set search_path = public as $$
declare pd smallint; prec uuid;
begin
  if new.parent_id is null then
    new.depth := 0;
  else
    select depth, recipe_id into pd, prec from comments where id = new.parent_id;
    if prec is distinct from new.recipe_id then raise exception 'parent belongs to another recipe'; end if;
    if pd >= 3 then raise exception 'max_depth' using errcode = 'P0001'; end if;
    new.depth := pd + 1;
  end if;
  return new;
end $$;
create trigger comments_depth before insert on comments for each row execute function trg_comment_depth();

create or replace function trg_comment_edit() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end $$;
create trigger comments_edit before update on comments for each row execute function trg_comment_edit();

alter table comments enable row level security;
create policy comments_read on comments for select using (
  can_view_recipe(recipe_id) and (moderation = 'visible' or user_id = auth.uid() or is_moderator())
);
create policy comments_insert on comments for insert to authenticated
  with check (user_id = auth.uid() and can_view_recipe(recipe_id) and not is_suspended()
              and not exists (select 1 from recipes r where r.id = recipe_id and r.moderation <> 'visible'));
create policy comments_update_own on comments for update to authenticated
  using (user_id = auth.uid() and deleted_at is null) with check (user_id = auth.uid());
grant insert (recipe_id, parent_id, user_id, body) on comments to authenticated;
grant update (body, deleted_at) on comments to authenticated;   -- "delete" is a soft delete

alter table comment_votes enable row level security;
create policy comment_votes_read on comment_votes for select using (user_id = auth.uid());
create policy comment_votes_ins on comment_votes for insert to authenticated
  with check (user_id = auth.uid() and not is_suspended());
create policy comment_votes_del on comment_votes for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── forum ─────────────────────────
alter table forum_topics enable row level security;
create policy topics_read on forum_topics for select using (
  status <> 'removed' or author_id = auth.uid() or is_moderator()
);
create policy topics_insert on forum_topics for insert to authenticated with check (
  author_id = auth.uid() and status = 'open' and not is_suspended()
  and exists (select 1 from forum_categories c where c.id = category_id and not c.is_archived)
);
-- authors may edit title/body while the topic is open; status/pin/feature are moderator-only (functions below)
create policy topics_update_own on forum_topics for update to authenticated
  using (author_id = auth.uid() and status = 'open' and not is_suspended()) with check (author_id = auth.uid());
-- authors may delete within the configurable window (site_settings.forum_delete_window_minutes, default 30)
create policy topics_delete_own on forum_topics for delete to authenticated using (
  author_id = auth.uid() and reply_count = 0 and created_at > now() - make_interval(
    mins => coalesce((select (value #>> '{}')::int from site_settings where key = 'forum_delete_window_minutes'), 30))
);
grant insert (slug, category_id, author_id, title, body, recipe_id) on forum_topics to authenticated;
grant update (title, body) on forum_topics to authenticated;
grant delete on forum_topics to authenticated;

alter table forum_topic_tags enable row level security;
create policy forum_topic_tags_read on forum_topic_tags for select using (true);
create policy forum_topic_tags_write on forum_topic_tags for all to authenticated
  using (exists (select 1 from forum_topics t where t.id = topic_id and t.author_id = auth.uid()))
  with check (exists (select 1 from forum_topics t where t.id = topic_id and t.author_id = auth.uid()));
grant insert, delete on forum_topic_tags to authenticated;

alter table forum_posts enable row level security;
create policy posts_read on forum_posts for select using (
  (moderation = 'visible' or author_id = auth.uid() or is_moderator())
  and exists (select 1 from forum_topics t where t.id = topic_id)       -- inherits topics_read
);
create policy posts_insert on forum_posts for insert to authenticated with check (
  author_id = auth.uid() and not is_suspended()
  and exists (select 1 from forum_topics t where t.id = topic_id and t.status = 'open')   -- locked/archived topics refuse replies
);
create policy posts_update_own on forum_posts for update to authenticated
  using (author_id = auth.uid() and not is_suspended()
         and exists (select 1 from forum_topics t where t.id = topic_id and t.status = 'open'))
  with check (author_id = auth.uid());
create policy posts_delete_own on forum_posts for delete to authenticated using (
  author_id = auth.uid() and created_at > now() - make_interval(
    mins => coalesce((select (value #>> '{}')::int from site_settings where key = 'forum_delete_window_minutes'), 30))
);
grant insert (topic_id, author_id, quoted_post_id, body) on forum_posts to authenticated;
grant update (body) on forum_posts to authenticated;
grant delete on forum_posts to authenticated;
create or replace function trg_post_edit() returns trigger language plpgsql as $$
begin if new.body is distinct from old.body then new.edited_at := now(); end if; return new; end $$;
create trigger forum_posts_edit before update on forum_posts for each row execute function trg_post_edit();

alter table forum_votes enable row level security;
create policy forum_votes_read on forum_votes for select using (user_id = auth.uid());
create policy forum_votes_ins on forum_votes for insert to authenticated with check (user_id = auth.uid() and not is_suspended());
create policy forum_votes_del on forum_votes for delete to authenticated using (user_id = auth.uid());
alter table forum_bookmarks enable row level security;
create policy forum_bookmarks_own on forum_bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table forum_follows enable row level security;
create policy forum_follows_own on forum_follows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── notifications ─────────────────────────
alter table notifications enable row level security;
create policy notifications_own_read on notifications for select using (user_id = auth.uid());
create policy notifications_own_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on notifications for delete to authenticated using (user_id = auth.uid());
grant update (read_at) on notifications to authenticated;
grant delete on notifications to authenticated;

-- ───────────────────────── moderation ─────────────────────────
alter table reports enable row level security;
create policy reports_insert on reports for insert to authenticated
  with check (reporter_id = auth.uid() and not is_suspended());
create policy reports_read on reports for select using (reporter_id = auth.uid() or is_moderator());
grant insert (reporter_id, target_type, target_id, reason, details) on reports to authenticated;

alter table moderation_actions enable row level security;
create policy moderation_actions_read on moderation_actions for select using (is_moderator());
alter table user_warnings enable row level security;
create policy warnings_read on user_warnings for select using (user_id = auth.uid() or is_moderator());
alter table user_suspensions enable row level security;
create policy suspensions_read on user_suspensions for select using (user_id = auth.uid() or is_moderator());

-- ───────────────────────── privileged functions ─────────────────────────
create or replace function log_moderation(p_action text, p_type text, p_target uuid, p_user uuid, p_reason text, p_report uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into moderation_actions (moderator_id, action, target_type, target_id, target_user_id, reason, report_id)
  values (auth.uid(), p_action, p_type, p_target, p_user, p_reason, p_report)
$$;

create or replace function require_moderator() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;
create or replace function require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

-- Roles: admin only; admins cannot demote the last remaining admin.
create or replace function admin_set_role(p_user uuid, p_role app_role, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_role <> 'admin' and (select role from user_roles where user_id = p_user) = 'admin'
     and (select count(*) from user_roles where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin' using errcode = '23514';
  end if;
  insert into user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  perform log_moderation('set_role:' || p_role, 'user', p_user, p_user, p_reason);
end $$;

-- Hide / remove / restore content. Moderators only; the author is notified.
create or replace function mod_set_state(p_type report_target, p_id uuid, p_state moderation_state,
                                         p_reason text, p_report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid; rid uuid;
begin
  perform require_moderator();
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'reason required'; end if;
  case p_type
    when 'recipe' then
      update recipes set moderation = p_state where id = p_id returning creator_id, id into owner, rid;
    when 'comment' then
      update comments set moderation = p_state where id = p_id returning user_id, recipe_id into owner, rid;
      -- hidden comments no longer count toward the displayed total
    when 'review' then
      update recipe_reviews set moderation = p_state where id = p_id returning user_id, recipe_id into owner, rid;
      perform recompute_recipe_rating(rid);
    when 'experiment' then
      update recipe_experiments set moderation = p_state where id = p_id returning user_id, recipe_id into owner, rid;
    when 'forum_post' then
      update forum_posts set moderation = p_state where id = p_id returning author_id into owner;
    when 'forum_topic' then
      update forum_topics set status = case p_state when 'visible' then 'open'::topic_status else 'removed'::topic_status end
       where id = p_id returning author_id into owner;
    else raise exception 'unsupported target';
  end case;
  if not found then raise exception 'not found'; end if;
  perform log_moderation('set_state:' || p_state, p_type::text, p_id, owner, p_reason, p_report);
  if p_state <> 'visible' then
    insert into notifications (user_id, actor_id, type, recipe_id, message)
    values (owner, null, 'moderation_action', rid, 'A moderator ' || p_state || ' your ' || replace(p_type::text, '_', ' ') || ': ' || p_reason);
  end if;
end $$;

create or replace function mod_set_topic_flags(p_topic uuid, p_status topic_status default null,
                                               p_pinned boolean default null, p_featured boolean default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_moderator();
  update forum_topics set status = coalesce(p_status, status), is_pinned = coalesce(p_pinned, is_pinned),
         is_featured = coalesce(p_featured, is_featured) where id = p_topic;
  perform log_moderation('topic_flags', 'forum_topic', p_topic,
                         (select author_id from forum_topics where id = p_topic), p_reason);
end $$;

create or replace function mod_feature_recipe(p_recipe uuid, p_featured boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_moderator();
  update recipes set is_featured = p_featured, featured_at = case when p_featured then now() end where id = p_recipe;
  perform log_moderation(case when p_featured then 'feature' else 'unfeature' end, 'recipe', p_recipe,
                         (select creator_id from recipes where id = p_recipe), p_reason);
end $$;

create or replace function mod_warn_user(p_user uuid, p_reason text, p_report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_moderator();
  insert into user_warnings (user_id, issued_by, reason) values (p_user, auth.uid(), p_reason);
  insert into notifications (user_id, type, message) values (p_user, 'moderation_action', 'You received a warning: ' || p_reason);
  perform log_moderation('warn', 'user', p_user, p_user, p_reason, p_report);
end $$;

create or replace function mod_suspend_user(p_user uuid, p_reason text, p_days int default null,
                                            p_permanent boolean default false, p_report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_moderator();
  if (select role from user_roles where user_id = p_user) in ('moderator', 'admin') and not is_admin() then
    raise exception 'only admins can suspend staff' using errcode = '42501';
  end if;
  if not p_permanent and (p_days is null or p_days < 1) then raise exception 'days required for a temporary suspension'; end if;
  insert into user_suspensions (user_id, issued_by, reason, is_permanent, ends_at)
  values (p_user, auth.uid(), p_reason, p_permanent, case when p_permanent then null else now() + make_interval(days => p_days) end);
  perform log_moderation(case when p_permanent then 'ban' else 'suspend' end, 'user', p_user, p_user, p_reason, p_report);
end $$;

create or replace function mod_lift_suspension(p_user uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_moderator();
  update user_suspensions set lifted_at = now() where user_id = p_user and lifted_at is null;
  perform log_moderation('restore_user', 'user', p_user, p_user, p_reason);
end $$;

create or replace function mod_resolve_report(p_report uuid, p_status report_status, p_resolution text,
                                              p_notes text default null, p_assign uuid default null, p_priority smallint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_moderator();
  update reports set status = p_status, resolution = coalesce(p_resolution, resolution),
         moderator_notes = coalesce(p_notes, moderator_notes), assigned_to = coalesce(p_assign, assigned_to, auth.uid()),
         priority = coalesce(p_priority, priority),
         resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end
   where id = p_report;
  if not found then raise exception 'not found'; end if;
  perform log_moderation('report:' || p_status, 'report', p_report, null, p_resolution, p_report);
end $$;

-- Reporter-facing helper so a user can see only the status of their own report.
-- Merge duplicate flavours: repoints recipe/aroma references, keeps the old name as a synonym.
create or replace function admin_merge_flavours(p_from uuid, p_into uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_name text;
begin
  perform require_admin();
  if p_from = p_into then raise exception 'cannot merge a flavour into itself'; end if;
  select name into old_name from flavours where id = p_from;
  update recipe_aromas set flavour_id = p_into where flavour_id = p_from;
  insert into aroma_flavours select aroma_id, p_into from aroma_flavours where flavour_id = p_from on conflict do nothing;
  delete from aroma_flavours where flavour_id = p_from;
  insert into flavour_category_links select p_into, category_id from flavour_category_links where flavour_id = p_from on conflict do nothing;
  update flavour_synonyms set flavour_id = p_into where flavour_id = p_from;
  insert into flavour_synonyms (term, flavour_id) values (lower(old_name), p_into) on conflict (term) do nothing;
  update flavours set merged_into = p_into where id = p_from;
  perform log_moderation('merge_flavour', 'flavour', p_from, null, p_reason);
end $$;

-- Immutable snapshot of a recipe and all its child rows (used by publish_recipe and the demo seed).
create or replace function recipe_snapshot(r recipes) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'recipe', to_jsonb(r) - 'search_tsv' - 'like_count' - 'save_count' - 'made_count' - 'view_count' - 'comment_count'
              - 'review_count' - 'rating_sum' - 'maker_review_count' - 'maker_rating_sum' - 'rating_dist'
              - 'bayes_rating' - 'trending_score',
    'base_ingredients', coalesce((select jsonb_agg(to_jsonb(x) order by position) from recipe_base_ingredients x where recipe_id = r.id), '[]'),
    'aromas', coalesce((select jsonb_agg(to_jsonb(x) order by position) from recipe_aromas x where recipe_id = r.id), '[]'),
    'steps', coalesce((select jsonb_agg(to_jsonb(x) order by step_number) from recipe_steps x where recipe_id = r.id), '[]'),
    'sources', coalesce((select jsonb_agg(to_jsonb(x) order by position) from recipe_sources x where recipe_id = r.id), '[]'),
    'tags', coalesce((select jsonb_agg(t.slug) from recipe_tags rt join tags t on t.id = rt.tag_id where rt.recipe_id = r.id), '[]'),
    'profiles', coalesce((select jsonb_agg(fp.slug) from recipe_flavour_profiles rp join flavour_profiles fp on fp.id = rp.profile_id where rp.recipe_id = r.id), '[]'))
$$;

-- Publish (or publish a new version of) a recipe. Validates the minimum dataset, snapshots all child rows.
create or replace function publish_recipe(p_recipe uuid, p_change_notes text default null, p_bump text default 'minor')
returns recipe_versions language plpgsql security definer set search_path = public as $$
declare r recipes; v recipe_versions; snap jsonb; first_publish boolean;
begin
  select * into r from recipes where id = p_recipe;
  if not found or r.creator_id is distinct from auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  if is_suspended() then raise exception 'account suspended' using errcode = '42501'; end if;
  if r.status = 'archived' then raise exception 'archived recipes cannot be published'; end if;
  -- minimum dataset
  if char_length(trim(r.title)) < 3 then raise exception 'invalid_recipe: title required'; end if;
  if not exists (select 1 from recipe_aromas where recipe_id = p_recipe) then
    raise exception 'invalid_recipe: add at least one aroma'; end if;
  if r.tobacco_weight is null and r.tobacco_product_name is null and r.tobacco_leaf_type is null then
    raise exception 'invalid_recipe: describe the tobacco (weight or type)'; end if;
  if not exists (select 1 from recipe_steps where recipe_id = p_recipe) then
    raise exception 'invalid_recipe: add at least one process step'; end if;
  first_publish := r.current_version_id is null;
  if not first_publish and (p_change_notes is null or char_length(trim(p_change_notes)) < 3) then
    raise exception 'invalid_recipe: change notes required for a new version'; end if;

  if not first_publish then
    if p_bump = 'major' then r.version_major := r.version_major + 1; r.version_minor := 0;
    else r.version_minor := r.version_minor + 1; end if;
  end if;

  snap := recipe_snapshot(r);

  insert into recipe_versions (recipe_id, version_major, version_minor, change_notes, snapshot, created_by)
  values (p_recipe, r.version_major, r.version_minor, p_change_notes, snap, auth.uid()) returning * into v;

  perform set_config('app.publishing', '1', true);
  update recipes set status = 'published', published_at = coalesce(published_at, now()),
         version_major = r.version_major, version_minor = r.version_minor, current_version_id = v.id
   where id = p_recipe;
  return v;
end $$;

-- Account deletion: anonymize the profile and keep community content (authors become NULL via FK).
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if is_admin() and (select count(*) from user_roles where role = 'admin') <= 1 then
    raise exception 'the last admin cannot delete their account'; end if;
  update profiles set username = 'deleted_' || substr(replace(id::text, '-', ''), 1, 10), display_name = null, bio = null,
         avatar_path = null, location = null, website = null, social_links = '{}', is_anonymized = true,
         pinned_recipe_id = null where id = auth.uid();
  -- the app then deletes the auth user with the service role; content authorship nulls out via FKs.
end $$;

-- ───────────────────────── function privileges ─────────────────────────
-- Revoke only our own functions (extension functions such as unaccent()/similarity() must stay callable).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
grant execute on function can_view_recipe(uuid), owns_recipe(uuid), is_moderator(), is_admin(), is_suspended(uuid),
      current_role_name() to anon, authenticated;
grant execute on function search_recipes(text, int, int), search_autocomplete(text, int), expand_search_terms(text), build_tsquery(text),
      trending_recipes(text, int, int), trending_window_hours(text), trending_half_life_hours(text),
      record_recipe_view(uuid) to anon, authenticated;
-- recipe_snapshot() is internal (no client grant)
grant execute on function check_rate_limit(text, int, int), publish_recipe(uuid, text, text), delete_my_account(),
      admin_set_role(uuid, app_role, text), admin_merge_flavours(uuid, uuid, text),
      mod_set_state(report_target, uuid, moderation_state, text, uuid), mod_set_topic_flags(uuid, topic_status, boolean, boolean, text),
      mod_feature_recipe(uuid, boolean, text), mod_warn_user(uuid, text, uuid),
      mod_suspend_user(uuid, text, int, boolean, uuid), mod_lift_suspension(uuid, text),
      mod_resolve_report(uuid, report_status, text, text, uuid, smallint) to authenticated;
-- refresh_trending_scores(), recompute_recipe_rating(), notify(), log_moderation(), require_*() stay service-side only.

-- ───────────────────────── default site settings ─────────────────────────
insert into site_settings (key, value) values
  ('site_name', '"SHISHA LAB"'),
  ('announcement', 'null'),
  ('forum_delete_window_minutes', '30'),
  ('age_minimum', '18'),
  ('age_notice', '"This community is for adults only. By continuing you confirm you are of legal age to use tobacco products in your jurisdiction."'),
  ('responsible_use_notice', '"Tobacco products are harmful and addictive. Nothing on this site encourages use."'),
  ('jurisdiction_notice', '"Laws on tobacco products and their preparation differ by country and region. You are responsible for following the laws that apply to you."'),
  ('health_notice', '"Recipes are user-generated experiences, not medical or safety guarantees. Homemade preparations are not tested or approved by any authority."'),
  ('community_rules', '"1. Be respectful. 2. No selling, trading or marketplace activity of any kind. 3. No links intended to facilitate purchases. 4. No content aimed at or encouraging use by minors. 5. Cite your sources. 6. No dangerous advice presented as fact."'),
  ('upload_max_image_mb', '5'),
  ('upload_max_pdf_mb', '10'),
  ('uploads_pdf_enabled', 'true')
on conflict (key) do nothing;

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('source-files', 'source-files', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Layout: <bucket>/<user_id>/<random-uuid>.<ext>. Users may write only inside their own folder.
create policy storage_public_read on storage.objects for select using (bucket_id in ('avatars', 'recipe-images'));
-- Source files are private by default; they become readable (via short-lived signed URLs) to anyone who may view
-- a recipe that references them, plus the uploader and staff.
create policy storage_source_files_read on storage.objects for select
  using (bucket_id = 'source-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or is_moderator()
    or exists (select 1 from recipe_sources s where s.file_path = name and can_view_recipe(s.recipe_id))));
create policy storage_own_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'recipe-images', 'source-files')
              and (storage.foldername(name))[1] = auth.uid()::text and not is_suspended());
create policy storage_own_update on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);
create policy storage_own_delete on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text or is_moderator());
