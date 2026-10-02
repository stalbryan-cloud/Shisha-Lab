\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
end $$;
create or replace function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'PASS  % (%)', label, sqlerrm; return; end;
  raise exception 'FAIL  % — statement succeeded but should have been denied', label;
end $$;
create or replace function pg_temp.expect_val(q text, expected text, label text) returns void language plpgsql as $$
declare v text;
begin
  execute q into v;
  if v is distinct from expected then raise exception 'FAIL  % — expected %, got %', label, expected, v; end if;
  raise notice 'PASS  %', label;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('a1000000-0000-0000-0000-00000000000a', 'pa@example.test', '{"username":"privalice"}'),
 ('b1000000-0000-0000-0000-00000000000b', 'pb@example.test', '{"username":"privbob"}');
update profiles set location = 'Utrecht', show_location = false, notification_prefs = '{"mention": false}' where username = 'privalice';

select pg_temp.as_user(null);
select pg_temp.expect_fail($$select location from profiles$$, 'anon cannot read profiles.location directly');
select pg_temp.expect_fail($$select notification_prefs from profiles$$, 'anon cannot read notification_prefs');
select pg_temp.expect_fail($$select age_acknowledged_at from profiles$$, 'anon cannot read age_acknowledged_at');
select pg_temp.expect_val($$select profile_location('a1000000-0000-0000-0000-00000000000a')$$, null, 'hidden location is not returned to anon');

select pg_temp.as_user('b1000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($$select location from profiles$$, 'signed-in user cannot read others'' location column');
select pg_temp.expect_val($$select profile_location('a1000000-0000-0000-0000-00000000000a')$$, null, 'hidden location is not returned to other members');

select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select pg_temp.expect_val($$select profile_location('a1000000-0000-0000-0000-00000000000a')$$, 'Utrecht', 'owner can read own location');
select pg_temp.expect_val($$select my_private_settings()->'notification_prefs'->>'mention'$$, 'false', 'owner reads own notification prefs');
select pg_temp.expect_val($$select count(*)::text from (select id, username from profiles) s$$, '2', 'public columns still readable');

-- creator analytics: only own recipes' series
reset role;
insert into recipes (slug, creator_id, title) values ('pa-r', 'a1000000-0000-0000-0000-00000000000a', 'PA recipe'), ('pb-r', 'b1000000-0000-0000-0000-00000000000b', 'PB recipe');
insert into recipe_view_daily (recipe_id, day, views) select id, current_date, 5 from recipes where slug in ('pa-r', 'pb-r');
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select pg_temp.expect_val($$select count(*)::text from creator_view_series(30)$$, '1', 'creator_view_series returns only the caller''s recipes');
select pg_temp.expect_val($$select count(*)::text from recipe_view_daily$$, '0', 'recipe_view_daily returns no rows when queried directly (RLS, no policy)');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select * from creator_view_series(30)$$, 'anon cannot call creator_view_series');

reset role;
rollback;
\echo finished
