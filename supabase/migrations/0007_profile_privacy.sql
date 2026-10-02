-- 0007: make profile privacy settings real at the database level (not just hidden in the UI).
--  * notification_prefs, age_acknowledged_at and location are no longer readable through the public API columns;
--    owners read them through my_private_settings() / profile_location().
--  * likes are readable only by their owner, moderators, or when the owner enabled show_likes.
--  * saved recipes are exposed to others only through profile_saved_ids(), which honours show_saved.

revoke select on profiles from anon, authenticated;
grant select (id, username, display_name, bio, avatar_path, website, social_links, experience_level, pinned_recipe_id,
              show_saved, show_likes, show_location, is_anonymized, created_at, updated_at)
  on profiles to anon, authenticated;

create or replace function my_private_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('notification_prefs', p.notification_prefs, 'age_acknowledged_at', p.age_acknowledged_at, 'location', p.location)
  from profiles p where p.id = auth.uid()
$$;

create or replace function profile_location(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.location from profiles p
  where p.id = p_user and (p.show_location or p.id = auth.uid() or is_moderator())
$$;

create or replace function profile_saved_ids(p_user uuid, p_limit int default 48) returns table (recipe_id uuid, saved_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.recipe_id, s.created_at
  from recipe_saves s join profiles p on p.id = s.user_id
  where s.user_id = p_user and (p.show_saved or p.id = auth.uid())
    and can_view_recipe(s.recipe_id)
  order by s.created_at desc limit least(p_limit, 100)
$$;

drop policy if exists likes_read on recipe_likes;
create policy likes_read on recipe_likes for select using (
  user_id = auth.uid() or is_moderator()
  or exists (select 1 from profiles p where p.id = recipe_likes.user_id and p.show_likes)
);

revoke all on function my_private_settings(), profile_location(uuid), profile_saved_ids(uuid, int) from public;
grant execute on function my_private_settings(), profile_location(uuid), profile_saved_ids(uuid, int) to anon, authenticated;
