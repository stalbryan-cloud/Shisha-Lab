-- SHISHA LAB — atomic replacement of a recipe's child rows (SECURITY INVOKER: RLS enforces ownership).
-- Called by the wizard's auto-save. One transaction: either all child rows are replaced or none.
-- Array position (ordinality) defines display order, so drag-and-drop ordering survives round trips.

create or replace function save_recipe_children(
  p_recipe uuid, p_base jsonb, p_aromas jsonb, p_steps jsonb, p_sources jsonb, p_tags text[], p_profiles text[]
) returns void language plpgsql set search_path = public as $$
begin
  if not owns_recipe(p_recipe) then raise exception 'forbidden' using errcode = '42501'; end if;

  delete from recipe_base_ingredients where recipe_id = p_recipe;
  insert into recipe_base_ingredients (recipe_id, position, category, ingredient_id, name, brand, weight_g, volume_ml,
                                       density_g_per_ml, pct_of_batch, pct_of_tobacco, notes)
  select p_recipe, (t.ord - 1)::int, (t.o->>'category')::base_ingredient_category, nullif(t.o->>'ingredient_id', '')::uuid,
         t.o->>'name', nullif(t.o->>'brand', ''), (t.o->>'weight_g')::numeric, (t.o->>'volume_ml')::numeric,
         (t.o->>'density_g_per_ml')::numeric, (t.o->>'pct_of_batch')::numeric, (t.o->>'pct_of_tobacco')::numeric,
         nullif(t.o->>'notes', '')
  from jsonb_array_elements(coalesce(p_base, '[]')) with ordinality as t(o, ord);

  delete from recipe_aromas where recipe_id = p_recipe;
  insert into recipe_aromas (recipe_id, position, aroma_id, brand, flavour_id, flavour_name, concentrate_name, weight_g,
                             volume_ml, pct_of_batch, manufacturer_recommended_pct, role, notes)
  select p_recipe, (t.ord - 1)::int, nullif(t.o->>'aroma_id', '')::uuid, nullif(t.o->>'brand', ''),
         nullif(t.o->>'flavour_id', '')::uuid, t.o->>'flavour_name', nullif(t.o->>'concentrate_name', ''),
         (t.o->>'weight_g')::numeric, (t.o->>'volume_ml')::numeric, (t.o->>'pct_of_batch')::numeric,
         (t.o->>'manufacturer_recommended_pct')::numeric, coalesce(nullif(t.o->>'role', ''), 'primary')::aroma_role,
         nullif(t.o->>'notes', '')
  from jsonb_array_elements(coalesce(p_aromas, '[]')) with ordinality as t(o, ord);

  delete from recipe_steps where recipe_id = p_recipe;
  insert into recipe_steps (recipe_id, step_number, category, title, instructions, duration_minutes, temperature,
                            temperature_unit, photo_path)
  select p_recipe, t.ord::int, nullif(t.o->>'category', ''), t.o->>'title', t.o->>'instructions',
         (t.o->>'duration_minutes')::int, (t.o->>'temperature')::numeric, nullif(t.o->>'temperature_unit', ''),
         nullif(t.o->>'photo_path', '')
  from jsonb_array_elements(coalesce(p_steps, '[]')) with ordinality as t(o, ord);

  delete from recipe_sources where recipe_id = p_recipe;
  insert into recipe_sources (recipe_id, position, title, source_type, url, file_path, file_mime, description, accessed_on)
  select p_recipe, (t.ord - 1)::int, t.o->>'title', (t.o->>'source_type')::source_type, nullif(t.o->>'url', ''),
         nullif(t.o->>'file_path', ''), nullif(t.o->>'file_mime', ''), nullif(t.o->>'description', ''),
         nullif(t.o->>'accessed_on', '')::date
  from jsonb_array_elements(coalesce(p_sources, '[]')) with ordinality as t(o, ord);

  delete from recipe_tags where recipe_id = p_recipe;
  insert into tags (slug, name)
  select distinct x, initcap(replace(x, '-', ' ')) from unnest(coalesce(p_tags, '{}')) x where x ~ '^[a-z0-9-]{1,40}$'
  on conflict (slug) do nothing;
  insert into recipe_tags (recipe_id, tag_id)
  select p_recipe, g.id from tags g where g.slug = any (coalesce(p_tags, '{}'));

  delete from recipe_flavour_profiles where recipe_id = p_recipe;
  insert into recipe_flavour_profiles (recipe_id, profile_id)
  select p_recipe, fp.id from flavour_profiles fp where fp.slug = any (coalesce(p_profiles, '{}'));
end $$;

grant execute on function save_recipe_children(uuid, jsonb, jsonb, jsonb, jsonb, text[], text[]) to authenticated;
