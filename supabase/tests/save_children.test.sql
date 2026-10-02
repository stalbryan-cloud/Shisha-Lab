\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end; end $$;
create or replace function pg_temp.expect(cond boolean, label text) returns void language plpgsql as $$
begin if not cond then raise exception 'FAIL  %', label; end if; raise notice 'PASS  %', label; end $$;
create or replace function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'PASS  % (%)', label, sqlerrm; return; end;
  raise exception 'FAIL  % — should have been denied', label; end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('a1000000-0000-0000-0000-00000000000a','a@example.test','{"username":"alice2"}'),
 ('b1000000-0000-0000-0000-00000000000b','b@example.test','{"username":"bob2"}');
insert into flavour_profiles (slug, name) values ('berry-t', 'Berry T') on conflict do nothing;

select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
insert into recipes (slug, creator_id, title) values ('wizard-draft','a1000000-0000-0000-0000-00000000000a','Wizard Draft');
select save_recipe_children(
  (select id from recipes where slug='wizard-draft'),
  '[{"category":"vegetable_glycerin","name":"VG","weight_g":35},{"category":"honey","name":"Honey","weight_g":10,"brand":""}]',
  '[{"flavour_name":"Blueberry","pct_of_batch":4,"role":"primary"},{"flavour_name":"Mint","pct_of_batch":0.5,"role":"cooling"},{"flavour_name":"Vanilla","pct_of_batch":1.5,"role":"secondary"}]',
  '[{"title":"Mix","instructions":"Combine"},{"title":"Rest","instructions":"Wait","duration_minutes":1440,"temperature":20,"temperature_unit":"C"}]',
  '[{"title":"My notes","source_type":"personal_experiment"}]',
  array['minimal','new-tag'], array['berry-t']);
select pg_temp.expect((select count(*) from recipe_base_ingredients) = 2, 'base ingredients saved');
select pg_temp.expect((select string_agg(flavour_name, ',' order by position) from recipe_aromas) = 'Blueberry,Mint,Vanilla', 'aroma order preserved');
select pg_temp.expect((select string_agg(step_number::text, ',' order by step_number) from recipe_steps) = '1,2', 'steps numbered in order');
select pg_temp.expect((select count(*) from recipe_tags) = 2, 'tags created and linked');
select pg_temp.expect((select count(*) from recipe_flavour_profiles) = 1, 'profile linked');
-- replace semantics (reorder + remove)
select save_recipe_children((select id from recipes where slug='wizard-draft'), '[]',
  '[{"flavour_name":"Vanilla","pct_of_batch":1.5},{"flavour_name":"Blueberry","pct_of_batch":4}]', '[]', '[]', '{}', '{}');
select pg_temp.expect((select string_agg(flavour_name, ',' order by position) from recipe_aromas) = 'Vanilla,Blueberry', 'reordering replaces rows');
select pg_temp.expect((select count(*) from recipe_base_ingredients) = 0, 'empty list clears rows');
select pg_temp.expect_fail($$select save_recipe_children((select id from recipes where slug='wizard-draft'), '[{"category":"nope","name":"x","weight_g":1}]','[]','[]','[]','{}','{}')$$, 'invalid enum value rejected, transaction unchanged');
select pg_temp.expect((select count(*) from recipe_aromas) = 2, 'failed save left previous rows intact');

select pg_temp.as_user('b1000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($$select save_recipe_children((select id from recipes where slug='wizard-draft'), '[]','[]','[]','[]','{}','{}')$$, 'another user cannot overwrite my recipe children');
select pg_temp.as_user(null);
select pg_temp.expect_fail($$select save_recipe_children(gen_random_uuid(), '[]','[]','[]','[]','{}','{}')$$, 'anonymous cannot call save_recipe_children');
rollback;
\echo 'save_children tests finished'
