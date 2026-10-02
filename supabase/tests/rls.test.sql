-- RLS / authorization tests. Run against a database with migrations applied (see README).
-- Each check raises an exception on failure; success prints NOTICE lines.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', true); execute 'reset role'; end $$;
create or replace function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'PASS  % (%)', label, sqlerrm; return; end;
  raise exception 'FAIL  % — statement succeeded but should have been denied', label;
end $$;
create or replace function pg_temp.expect_rows(q text, expected bigint, label text) returns void language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n <> expected then raise exception 'FAIL  % — expected % rows, got %', label, expected, n; end if;
  raise notice 'PASS  %', label;
end $$;

-- fixtures (as the table owner / service role)
insert into auth.users (id, email, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-00000000000a', 'a@example.test', '{"username":"alice"}'),
 ('b0000000-0000-0000-0000-00000000000b', 'b@example.test', '{"username":"bob"}'),
 ('c0000000-0000-0000-0000-00000000000c', 'm@example.test', '{"username":"modmo"}'),
 ('d0000000-0000-0000-0000-00000000000d', 'x@example.test', '{"username":"adminx"}');
update user_roles set role = 'moderator' where user_id = 'c0000000-0000-0000-0000-00000000000c';
update user_roles set role = 'admin' where user_id = 'd0000000-0000-0000-0000-00000000000d';
insert into forum_categories (slug, name) values ('rls-test-category', 'RLS test category');

-- ── Alice builds and publishes a recipe through the normal client path ──
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into recipes (slug, creator_id, title, tobacco_weight, tobacco_leaf_family)
  values ('alice-berry', 'a0000000-0000-0000-0000-00000000000a', 'Berry Test', 200, 'dark');
insert into recipes (slug, creator_id, title, visibility) values ('alice-private', 'a0000000-0000-0000-0000-00000000000a', 'Private One', 'private');
insert into recipe_aromas (recipe_id, flavour_name, pct_of_batch, role)
  select id, 'Blueberry', 4, 'primary' from recipes where slug = 'alice-berry';
insert into recipe_steps (recipe_id, step_number, title, instructions)
  select id, 1, 'Mix', 'Combine everything' from recipes where slug = 'alice-berry';
select pg_temp.expect_fail($$update recipes set status = 'published', published_at = now() where slug = 'alice-berry'$$, 'cannot publish by direct UPDATE (must use publish_recipe)');
select publish_recipe(id, null) from recipes where slug = 'alice-berry';

select pg_temp.expect_rows($$select 1 from recipes where slug = 'alice-berry' and status = 'published'$$, 1, 'publish_recipe publishes and sets status');
select pg_temp.expect_rows($$select 1 from recipe_versions where version_major = 1 and version_minor = 0$$, 1, 'publish creates v1.0 snapshot');
select pg_temp.expect_fail($$insert into recipes (slug, creator_id, title) values ('spoof', 'b0000000-0000-0000-0000-00000000000b', 'Spoofed owner')$$, 'cannot create a recipe as another user');
select pg_temp.expect_fail($$update recipes set is_featured = true where slug = 'alice-berry'$$, 'owner cannot self-feature (column grant)');
select pg_temp.expect_fail($$update recipes set like_count = 999 where slug = 'alice-berry'$$, 'owner cannot edit counters');
select pg_temp.expect_fail($$update recipes set moderation = 'visible' where slug = 'alice-berry'$$, 'owner cannot edit moderation state');
select pg_temp.expect_fail($$update profiles set is_anonymized = true where id = 'a0000000-0000-0000-0000-00000000000a'$$, 'user cannot edit protected profile columns');
select pg_temp.expect_fail($$insert into user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin') on conflict (user_id) do update set role = 'admin'$$, 'user cannot grant themselves a role');
select pg_temp.expect_fail($$select admin_set_role('a0000000-0000-0000-0000-00000000000a', 'admin')$$, 'non-admin cannot call admin_set_role');

-- ── anonymous visitor ──
select pg_temp.as_user(null);
select pg_temp.expect_rows($$select 1 from recipes where slug = 'alice-berry'$$, 1, 'anon can read public recipe');
select pg_temp.expect_rows($$select 1 from recipes where slug = 'alice-private'$$, 0, 'anon cannot see private recipe');
select pg_temp.expect_rows($$select 1 from recipe_aromas$$, 1, 'anon sees aromas only of visible recipes');
select pg_temp.expect_fail($$update recipes set title = 'hacked' where slug = 'alice-berry'$$, 'anon cannot update (no grant)');
select pg_temp.expect_fail($$insert into recipe_likes values ((select id from recipes where slug='alice-berry'), 'a0000000-0000-0000-0000-00000000000a')$$, 'anon cannot like');

-- ── Bob (second account) ──
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
update recipes set title = 'Bob edit' where slug = 'alice-berry';
select pg_temp.as_service();
select pg_temp.expect_rows($$select 1 from recipes where title = 'Bob edit'$$, 0, 'Bob cannot update Alice recipe (0 rows affected)');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows($$select 1 from recipes where slug = 'alice-private'$$, 0, 'Bob cannot see Alice private recipe');
delete from recipe_aromas;   -- RLS filters to zero rows
select pg_temp.as_service();
select pg_temp.expect_rows($$select 1 from recipe_aromas$$, 1, 'Bob''s DELETE did not remove Alice''s aromas');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into recipe_likes (recipe_id, user_id) select id, 'b0000000-0000-0000-0000-00000000000b' from recipes where slug = 'alice-berry';
insert into recipe_saves (recipe_id, user_id) select id, 'b0000000-0000-0000-0000-00000000000b' from recipes where slug = 'alice-berry';
select pg_temp.expect_fail($$insert into recipe_likes (recipe_id, user_id) select id, 'a0000000-0000-0000-0000-00000000000a' from recipes where slug = 'alice-berry'$$, 'cannot like on behalf of another user');
select pg_temp.expect_rows($$select 1 from recipe_saves$$, 1, 'Bob sees his own save');
insert into recipe_experiments (recipe_id, user_id, version_major, version_minor, overall, would_make_again, notes, visibility)
  select id, 'b0000000-0000-0000-0000-00000000000b', 1, 0, 4, 'yes', 'tasty', 'public' from recipes where slug = 'alice-berry';
insert into recipe_reviews (recipe_id, user_id, maker_status, overall, version_major, version_minor)
  select id, 'b0000000-0000-0000-0000-00000000000b', 'made_exactly', 4, 1, 0 from recipes where slug = 'alice-berry';
select pg_temp.expect_fail($$insert into recipe_reviews (recipe_id, user_id, overall) select id, 'b0000000-0000-0000-0000-00000000000b', 5 from recipes where slug = 'alice-berry'$$, 'duplicate review for same recipe rejected');
update recipe_reviews set overall = 5 where user_id = 'b0000000-0000-0000-0000-00000000000b';   -- own rating can be updated
select pg_temp.as_service();
select pg_temp.expect_rows($$select 1 from recipes where slug='alice-berry' and like_count=1 and save_count=1 and made_count=1 and review_count=1 and maker_review_count=1$$, 1, 'counters maintained by triggers');
select pg_temp.expect_rows($$select 1 from recipes where slug='alice-berry' and rating_dist = '{0,0,0,0,1}' and bayes_rating > 3.5 and bayes_rating < 5$$, 1, 'bayesian rating shrinks a single 5-star toward the prior');

-- Alice cannot review her own recipe
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($$insert into recipe_reviews (recipe_id, user_id, overall) select id, 'a0000000-0000-0000-0000-00000000000a', 5 from recipes where slug = 'alice-berry'$$, 'creator cannot rate own recipe');
select pg_temp.expect_rows($$select 1 from recipe_saves$$, 0, 'Alice cannot read Bob''s private saves');

-- comments: thread + depth limit + ownership
insert into comments (recipe_id, user_id, body) select id, 'a0000000-0000-0000-0000-00000000000a', 'root' from recipes where slug='alice-berry';
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into comments (recipe_id, user_id, body, parent_id) select recipe_id, 'b0000000-0000-0000-0000-00000000000b', 'reply', id from comments where body='root';
update comments set body = 'tampered' where body = 'root';
select pg_temp.as_service();
select pg_temp.expect_rows($$select 1 from comments where body = 'root'$$, 1, 'Bob cannot edit Alice''s comment');
select pg_temp.expect_rows($$select 1 from comments where body='reply' and depth = 1$$, 1, 'depth is derived by trigger');

-- forum
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into forum_topics (slug, category_id, author_id, title, body)
  select 'first-topic', id, 'b0000000-0000-0000-0000-00000000000b', 'First topic here', 'hello' from forum_categories;
select pg_temp.expect_fail($$update forum_topics set status = 'locked', is_pinned = true where slug = 'first-topic'$$, 'author cannot lock/pin own topic (column grant)');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into forum_posts (topic_id, author_id, body) select id, 'a0000000-0000-0000-0000-00000000000a', 'a reply' from forum_topics;
select pg_temp.as_service();
select pg_temp.expect_rows($$select 1 from forum_topics where reply_count = 1$$, 1, 'forum reply counter maintained');
select pg_temp.expect_rows($$select 1 from notifications where type = 'topic_reply'$$, 1, 'topic reply notifies the author');

-- reports + moderation
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into reports (reporter_id, target_type, target_id, reason, details)
  select 'b0000000-0000-0000-0000-00000000000b', 'comment', id, 'spam', 'looks spammy' from comments where body = 'root';
select pg_temp.expect_rows($$select 1 from reports$$, 1, 'reporter sees own report');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($$select 1 from reports$$, 0, 'other users cannot see reports');
select pg_temp.expect_fail($$select mod_set_state('comment', (select id from comments limit 1), 'removed', 'because')$$, 'normal user cannot moderate');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows($$select 1 from reports where status = 'open'$$, 1, 'moderator sees open report');
select mod_set_state('comment', (select id from comments where body = 'root'), 'hidden', 'spam confirmed', (select id from reports limit 1));
select mod_resolve_report((select id from reports limit 1), 'resolved', 'comment hidden');
select pg_temp.expect_rows($$select 1 from moderation_actions$$, 2, 'moderation actions are audit-logged');
select pg_temp.expect_fail($$select admin_set_role('b0000000-0000-0000-0000-00000000000b', 'moderator')$$, 'moderator cannot change roles');
select pg_temp.as_user(null);
select pg_temp.expect_rows($$select 1 from comments where body = 'root'$$, 0, 'hidden comment is no longer public');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select admin_set_role('b0000000-0000-0000-0000-00000000000b', 'trusted_user', 'promote');
select pg_temp.expect_fail($$select mod_suspend_user('a0000000-0000-0000-0000-00000000000a', 'x', null, false)$$, 'temporary suspension requires days');
select mod_suspend_user('a0000000-0000-0000-0000-00000000000a', 'abuse', 7, false);
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($$insert into comments (recipe_id, user_id, body) select id, 'a0000000-0000-0000-0000-00000000000a', 'still posting' from recipes where slug='alice-berry'$$, 'suspended user cannot comment');
select pg_temp.expect_fail($$insert into forum_posts (topic_id, author_id, body) select id, 'a0000000-0000-0000-0000-00000000000a', 'again' from forum_topics$$, 'suspended user cannot post');

-- locked topic refuses replies
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select mod_set_topic_flags((select id from forum_topics limit 1), 'locked', null, null, 'cooldown');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($$insert into forum_posts (topic_id, author_id, body) select id, 'b0000000-0000-0000-0000-00000000000b', 'reply to locked' from forum_topics$$, 'locked topic refuses replies');

-- private storage / anon cannot read internal tables
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select * from rate_limits$$, 'anon cannot read rate_limits');
select pg_temp.expect_fail($$select * from recipe_events$$, 'anon cannot read recipe_events');
select pg_temp.expect_fail($$select refresh_trending_scores()$$, 'anon cannot call internal functions');

rollback;
\echo 'RLS tests finished'
