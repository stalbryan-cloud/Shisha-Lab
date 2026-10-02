\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end; end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub',''  , true); execute 'reset role'; end $$;
create or replace function pg_temp.expect(cond boolean, label text) returns void language plpgsql as $$
begin if not cond then raise exception 'FAIL  %', label; end if; raise notice 'PASS  %', label; end $$;
create or replace function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'PASS  % (%)', label, sqlerrm; return; end;
  raise exception 'FAIL  % — should have been denied', label; end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('a2000000-0000-0000-0000-00000000000a','a@example.test','{"username":"ann_h"}'),
 ('b2000000-0000-0000-0000-00000000000b','b@example.test','{"username":"ben_h"}'),
 ('c2000000-0000-0000-0000-00000000000c','m@example.test','{"username":"mod_h"}');
update user_roles set role = 'moderator' where user_id = 'c2000000-0000-0000-0000-00000000000c';
insert into forum_categories (slug, name) values ('recipes-experiments', 'Recipes & Experiments') on conflict do nothing;

select pg_temp.as_user('a2000000-0000-0000-0000-00000000000a');
insert into recipes (slug, creator_id, title, tobacco_weight) values ('helper-recipe','a2000000-0000-0000-0000-00000000000a','Helper Recipe',100);
insert into recipe_aromas (recipe_id, flavour_name, pct_of_batch) select id,'Mint',1 from recipes where slug='helper-recipe';
insert into recipe_steps (recipe_id, step_number, title, instructions) select id,1,'Mix','Do it' from recipes where slug='helper-recipe';
select publish_recipe(id) from recipes where slug='helper-recipe';

select pg_temp.as_user('b2000000-0000-0000-0000-00000000000b');
insert into comments (recipe_id, user_id, body) select id,'b2000000-0000-0000-0000-00000000000b','Question about @ann_h and @nobody' from recipes where slug='helper-recipe';
select notify_mentions(array['ann_h','nobody','ben_h'], (select id from recipes where slug='helper-recipe'), null, (select id from comments limit 1));
select pg_temp.as_service();
select pg_temp.expect((select count(*) from notifications where type='mention' and user_id='a2000000-0000-0000-0000-00000000000a') = 1, 'mention notifies the mentioned user once');
select pg_temp.expect((select count(*) from notifications where type='mention' and user_id='b2000000-0000-0000-0000-00000000000b') = 0, 'no self-mention notification');

select pg_temp.as_user('a2000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($$select notify_mentions(array['ben_h'], null, null, (select id from comments limit 1))$$, 'cannot fake mentions on someone else''s comment');

select pg_temp.as_user('b2000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select continue_in_community((select id from comments limit 1))) is not null, 'continue_in_community creates a topic and returns its slug');
select pg_temp.expect((select continue_in_community((select id from comments limit 1))) = (select slug from forum_topics limit 1), 'second call returns the same topic');
select pg_temp.expect((select count(*) from forum_topics) = 1, 'only one topic created for the thread');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select continue_in_community((select id from comments limit 1))$$, 'anonymous cannot continue a discussion');

-- staff badges visible to anyone, without exposing the roles table
select pg_temp.expect((select count(*) from staff_user_ids(array['c2000000-0000-0000-0000-00000000000c'::uuid,'a2000000-0000-0000-0000-00000000000a'::uuid])) = 1, 'staff_user_ids returns moderators only (anon)');
select pg_temp.expect((select count(*) from user_roles) = 0, 'anon cannot read user_roles directly');

-- report queue
select pg_temp.as_user('a2000000-0000-0000-0000-00000000000a');
insert into reports (reporter_id, target_type, target_id, reason) select 'a2000000-0000-0000-0000-00000000000a','comment',id,'harassment' from comments limit 1;
select pg_temp.expect_fail($$select * from report_queue()$$, 'normal user cannot open the report queue');
select pg_temp.expect_fail($$select admin_dashboard()$$, 'normal user cannot open the admin dashboard');
select pg_temp.as_user('c2000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from report_queue('open')) = 1, 'moderator sees the open report with preview');
select pg_temp.expect((select preview from report_queue('open') limit 1) like 'Question about%', 'queue shows a preview of the reported comment');
select pg_temp.expect((select link from report_queue('open') limit 1) like '/recipes/helper-recipe#comment-%', 'queue links to the reported content');
select pg_temp.expect((admin_dashboard()->>'open_reports')::int = 1, 'dashboard counts open reports');
rollback;
\echo 'helpers tests finished'
