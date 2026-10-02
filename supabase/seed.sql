-- SHISHA LAB — DEVELOPMENT / DEMO SEED DATA
-- Everything here is fictional demo content (is_demo = true where the table supports it).
-- Brands, products and people are invented; nothing is a real product claim, safety claim or endorsement.
-- Demo users have no password and cannot log in; create real accounts through the app and promote one
-- to admin with:  update user_roles set role = 'admin' where user_id = '<your auth user id>';
-- Run as a role that bypasses RLS (service role / postgres):  psql "$DATABASE_URL" -f supabase/seed.sql

begin;
select setseed(0.4242);
set local app.publishing = '1';

-- ───────────────────────── taxonomy ─────────────────────────
insert into flavour_categories (slug, name, sort_order) values
 ('fruit','Fruit',1),('berry','Berry',2),('citrus','Citrus',3),('tropical','Tropical',4),('fresh','Fresh',5),
 ('cooling','Cooling',6),('cream','Cream',7),('dessert','Dessert',8),('bakery','Bakery',9),('candy','Candy',10),
 ('beverage','Beverage',11),('spice','Spice',12),('herbal','Herbal',13),('floral','Floral',14),('nut','Nut',15),
 ('traditional','Traditional',16),('earthy','Earthy',17),('woody','Woody',18),('other','Other',19)
on conflict do nothing;

insert into flavours (slug, name) values
 ('apple','Apple'),('blueberry','Blueberry'),('grape','Grape'),('lemon','Lemon'),('lime','Lime'),('orange','Orange'),
 ('watermelon','Watermelon'),('peach','Peach'),('mango','Mango'),('vanilla','Vanilla'),('caramel','Caramel'),
 ('coffee','Coffee'),('cinnamon','Cinnamon'),('mint','Mint'),('menthol','Menthol'),('cream','Cream'),
 ('blackcurrant','Blackcurrant'),('strawberry','Strawberry'),('pineapple','Pineapple'),('rose','Rose')
on conflict do nothing;

insert into flavour_category_links (flavour_id, category_id)
select f.id, c.id from (values
 ('apple','fruit'),('blueberry','berry'),('blueberry','fruit'),('grape','fruit'),('lemon','citrus'),('lemon','fruit'),
 ('lime','citrus'),('lime','fruit'),('orange','citrus'),('orange','fruit'),('watermelon','fruit'),('watermelon','fresh'),
 ('peach','fruit'),('mango','tropical'),('mango','fruit'),('vanilla','cream'),('vanilla','dessert'),
 ('caramel','dessert'),('caramel','candy'),('coffee','beverage'),('coffee','bakery'),('cinnamon','spice'),('cinnamon','bakery'),
 ('mint','herbal'),('mint','fresh'),('menthol','cooling'),('cream','cream'),('cream','dessert'),
 ('blackcurrant','berry'),('blackcurrant','fruit'),('strawberry','berry'),('strawberry','fruit'),
 ('pineapple','tropical'),('pineapple','fruit'),('rose','floral')
) v(f, c) join flavours f on f.slug = v.f join flavour_categories c on c.slug = v.c
on conflict do nothing;

-- Synonyms live in the database (not in UI code). `concept` entries map ingredient jargon.
insert into flavour_synonyms (term, flavour_id)
select v.t, f.id from (values
 ('cassis','blackcurrant'),('black currant','blackcurrant'),('spearmint','mint'),('peppermint','mint'),
 ('icy','menthol'),('ice','menthol'),('vanille','vanilla'),('double apple','apple'),('two apples','apple'),
 ('cappuccino','coffee'),('espresso','coffee'),('cantaloupe','watermelon'),('creamy','cream'),('custard','cream')
) v(t, s) join flavours f on f.slug = v.s on conflict do nothing;
insert into flavour_synonyms (term, category_id)
select v.t, c.id from (values ('citrusy','citrus'),('cooling','cooling'),('minty','fresh'),('sweet','dessert')) v(t, s)
join flavour_categories c on c.slug = v.s on conflict do nothing;
insert into flavour_synonyms (term, concept) values
 ('vg','vegetable_glycerin'),('vegetable glycerin','vegetable_glycerin'),('glycerol','vegetable_glycerin'),
 ('glycerin','vegetable_glycerin'),('glycerine','vegetable_glycerin'),('pg','propylene_glycol'),
 ('propylene glycol','propylene_glycol'),('molasse','molasses'),('treacle','molasses')
on conflict do nothing;

insert into flavour_profiles (slug, name, sort_order) values
 ('fruity','Fruity',1),('citrus','Citrus',2),('tropical','Tropical',3),('berry','Berry',4),('fresh','Fresh',5),
 ('cooling','Cooling',6),('creamy','Creamy',7),('dessert','Dessert',8),('bakery','Bakery',9),('spiced','Spiced',10),
 ('floral','Floral',11),('beverage','Beverage',12),('candy','Candy',13),('traditional','Traditional',14),
 ('earthy','Earthy',15),('woody','Woody',16),('herbal','Herbal',17),('sweet','Sweet',18),('sour','Sour',19),
 ('complex','Complex',20),('experimental','Experimental',21)
on conflict do nothing;

insert into tags (slug, name) values
 ('beginner-friendly','Beginner friendly'),('long-rest','Long rest'),('honey-based','Honey based'),
 ('molasses-based','Molasses based'),('washed-leaf','Washed leaf'),('minimal','Minimal'),('layered','Layered'),
 ('summer','Summer'),('winter','Winter'),('low-cooling','Low cooling'),('high-cloud','High cloud'),('classic','Classic')
on conflict do nothing;

-- ───────────────────────── ingredient database (fictional) ─────────────────────────
insert into aroma_brands (slug, name, country, is_demo) values
 ('aurelia-essences','Aurelia Essences (demo)','Netherlands',true),('nordlicht-aromas','Nordlicht Aromas (demo)','Germany',true),
 ('copper-still','Copper Still Flavours (demo)','United Kingdom',true),('lumen-labs','Lumen Labs (demo)','Poland',true),
 ('oasis-extracts','Oasis Extracts (demo)','Jordan',true),('verdant-drop','Verdant Drop (demo)','Bulgaria',true),
 ('salt-and-sugar','Salt & Sugar Co. (demo)','Belgium',true),('harbor-notes','Harbor Notes (demo)','Denmark',true)
on conflict do nothing;

insert into aromas (slug, brand_id, product_name, concentration_notes, recommended_min_pct, recommended_max_pct, is_demo)
select v.slug, b.id, v.pname, v.note, v.mn, v.mx, true from (values
 ('aurelia-blueberry-burst','aurelia-essences','Blueberry Burst','Strong; most users report 3–5%',2.0,5.0),
 ('aurelia-vanilla-silk','aurelia-essences','Vanilla Silk','Soft, rounded; works from 1%',0.5,3.0),
 ('nordlicht-cool-mint','nordlicht-aromas','Cool Mint','Very sharp; small amounts',0.3,1.5),
 ('nordlicht-menthol-ice','nordlicht-aromas','Menthol Ice','Cooling agent, can dominate above 0.5%',0.1,0.8),
 ('copper-still-double-apple','copper-still','Double Apple','Anise-leaning; classic profile',3.0,8.0),
 ('copper-still-grape-nectar','copper-still','Grape Nectar','Sweet; pairs with mint',2.0,6.0),
 ('lumen-lemon-zest','lumen-labs','Lemon Zest','Bright; fades quickly',1.5,4.0),
 ('lumen-lime-twist','lumen-labs','Lime Twist','Sharp, slightly bitter',1.0,3.0),
 ('lumen-orange-peel','lumen-labs','Orange Peel','Oily top note',1.0,3.5),
 ('oasis-watermelon-slice','oasis-extracts','Watermelon Slice','Light; needs higher dosage',3.0,7.0),
 ('oasis-peach-orchard','oasis-extracts','Peach Orchard','Rounded, jam-like',2.0,5.0),
 ('oasis-mango-sun','oasis-extracts','Mango Sun','Tropical, heavy sweetness',2.0,5.0),
 ('verdant-rose-garden','verdant-drop','Rose Garden','Potent; use sparingly',0.2,1.0),
 ('verdant-blackcurrant','verdant-drop','Blackcurrant Dusk','Tart berry, deep',1.5,4.0),
 ('salt-sugar-salted-caramel','salt-and-sugar','Salted Caramel','Dessert base; pairs with coffee',2.0,5.0),
 ('salt-sugar-cream-whip','salt-and-sugar','Cream Whip','Smooths sharp fruit',1.0,4.0),
 ('harbor-coffee-roast','harbor-notes','Coffee Roast','Dark, slightly bitter',2.0,5.0),
 ('harbor-cinnamon-stick','harbor-notes','Cinnamon Stick','Warm; strong above 1%',0.3,1.5),
 ('harbor-strawberry-field','harbor-notes','Strawberry Field','Candy-sweet',2.0,5.0),
 ('harbor-pineapple-cove','harbor-notes','Pineapple Cove','Juicy tropical',2.0,5.0)
) v(slug, brand, pname, note, mn, mx) join aroma_brands b on b.slug = v.brand
on conflict do nothing;

insert into aroma_flavours (aroma_id, flavour_id)
select a.id, f.id from (values
 ('aurelia-blueberry-burst','blueberry'),('aurelia-vanilla-silk','vanilla'),('nordlicht-cool-mint','mint'),
 ('nordlicht-menthol-ice','menthol'),('copper-still-double-apple','apple'),('copper-still-grape-nectar','grape'),
 ('lumen-lemon-zest','lemon'),('lumen-lime-twist','lime'),('lumen-orange-peel','orange'),
 ('oasis-watermelon-slice','watermelon'),('oasis-peach-orchard','peach'),('oasis-mango-sun','mango'),
 ('verdant-rose-garden','rose'),('verdant-blackcurrant','blackcurrant'),('salt-sugar-salted-caramel','caramel'),
 ('salt-sugar-cream-whip','cream'),('harbor-coffee-roast','coffee'),('harbor-cinnamon-stick','cinnamon'),
 ('harbor-strawberry-field','strawberry'),('harbor-pineapple-cove','pineapple')
) v(a, f) join aromas a on a.slug = v.a join flavours f on f.slug = v.f on conflict do nothing;

insert into tobacco_brands (slug, name, country, is_demo) values
 ('kestrel-leaf','Kestrel Leaf Co. (demo)','Netherlands',true),('ember-ash','Ember & Ash (demo)','Germany',true),
 ('old-quarry','Old Quarry Tobacco (demo)','United States',true),('sundial-leaf','Sundial Leaf (demo)','Greece',true),
 ('marrow-lane','Marrow Lane (demo)','Poland',true)
on conflict do nothing;
insert into tobacco_leaf_types (slug, name, family) values
 ('virginia','Virginia','blonde'),('burley','Burley','blonde'),('kentucky','Kentucky','dark'),
 ('dark-fired','Dark-fired','dark'),('oriental','Oriental','other'),('perique','Perique','dark')
on conflict do nothing;
insert into tobaccos (slug, brand_id, product_name, leaf_type_id, variety, origin, cut, notes, is_demo)
select v.slug, b.id, v.pname, l.id, v.variety, v.origin, v.cut, v.notes, true from (values
 ('kestrel-bright-virginia','kestrel-leaf','Bright Virginia Fine','virginia','Flue-cured Virginia','Brazil','fine','Mild, light, takes flavour readily'),
 ('kestrel-pale-burley','kestrel-leaf','Pale Burley Medium','burley','Air-cured Burley','Malawi','medium','Absorbent, nutty'),
 ('ember-dark-kentucky','ember-ash','Dark Kentucky Coarse','kentucky','Kentucky dark','United States','coarse','Strong, earthy'),
 ('ember-fire-cured','ember-ash','Fire-cured Reserve','dark-fired','Dark-fired','United States','medium','Smoky'),
 ('quarry-golden-leaf','old-quarry','Golden Leaf Medium','virginia','Golden Virginia','United States','medium','Balanced sweetness'),
 ('quarry-heavy-burley','old-quarry','Heavy Burley Cut','burley','Burley','Malawi','coarse','Full bodied'),
 ('sundial-aegean-oriental','sundial-leaf','Aegean Oriental Shred','oriental','Basma','Greece','fine','Aromatic, delicate'),
 ('sundial-perique-blend','sundial-leaf','Perique Accent Blend','perique','Perique','United States','medium','Fruity, tangy'),
 ('marrow-lane-honey-virginia','marrow-lane','Honey Virginia','virginia','Virginia','Bulgaria','fine','Pre-sweetened feel'),
 ('marrow-lane-black-reserve','marrow-lane','Black Reserve','kentucky','Kentucky','Poland','coarse','Dense, robust')
) v(slug, brand, pname, leaf, variety, origin, cut, notes)
join tobacco_brands b on b.slug = v.brand join tobacco_leaf_types l on l.slug = v.leaf on conflict do nothing;

insert into ingredients (slug, name, category, density_g_per_ml, notes) values
 ('vg','Vegetable glycerin','vegetable_glycerin',1.26,'Density approx. 1.26 g/ml'),
 ('pg','Propylene glycol','propylene_glycol',1.04,null),
 ('honey-wildflower','Wildflower honey','honey',1.42,null),
 ('molasses-dark','Dark molasses','molasses',1.40,null),
 ('invert-syrup','Invert sugar syrup','invert_syrup',1.33,null),
 ('glucose-syrup','Glucose syrup','glucose_syrup',1.38,null),
 ('water-distilled','Distilled water','water',1.00,null)
on conflict do nothing;

-- ───────────────────────── forum categories ─────────────────────────
insert into forum_categories (slug, name, description, sort_order) values
 ('general','General Shisha Making','Open discussion about making your own blends',1),
 ('tobacco-leaf','Tobacco & Leaf','Leaf types, cuts, origins and preparation',2),
 ('aromas-flavouring','Aromas & Flavouring','Concentrates, dosage and layering',3),
 ('sweeteners','Glycerin / Molasses / Sweeteners','Moisture and sweetness balance',4),
 ('recipes-experiments','Recipes & Experiments','Share and dissect recipes and test results',5),
 ('troubleshooting','Troubleshooting','Harsh, flat, wet, dry — fix it',6),
 ('equipment','Equipment','Scales, containers, tools',7),
 ('traditional','Traditional Methods','Time-honoured approaches',8),
 ('modern','Modern Methods','New techniques',9),
 ('flavour-development','Flavour Development','Composition and layering theory',10),
 ('beginners','Beginner Questions','No question too basic',11),
 ('research','Research & Sources','Citations and further reading',12),
 ('feedback','Website Feedback','Tell us how to improve the site',13)
on conflict do nothing;

-- ───────────────────────── users ─────────────────────────
create temp table seed_users (idx int primary key, id uuid, username text, display text, bio text, level text, loc text);
insert into seed_users values
 (1,'11111111-0000-4000-8000-000000000001','leafwright','Mara Leafwright','Washes everything twice and measures to 0.01 g.','expert','Utrecht'),
 (2,'11111111-0000-4000-8000-000000000002','moltenmill','Jonas Müller','Molasses-first tinkerer, slow rests.','advanced','Hamburg'),
 (3,'11111111-0000-4000-8000-000000000003','citruscadence','Ines Moreau','Bright, clean fruit blends only.','intermediate','Lyon'),
 (4,'11111111-0000-4000-8000-000000000004','darkroomdan','Dan Whitcombe','Dark leaf and heavy desserts.','advanced','Leeds'),
 (5,'11111111-0000-4000-8000-000000000005','honeybadgerhq','Priya Nair','Honey-based experiments, tasting notes obsessive.','intermediate','Rotterdam'),
 (6,'11111111-0000-4000-8000-000000000006','quietcloud','Tomasz Zielinski','Cloud performance and moisture ratios.','advanced','Kraków'),
 (7,'11111111-0000-4000-8000-000000000007','mintcondition','Sofia Alvarez','Mint and menthol layering.','intermediate','Valencia'),
 (8,'11111111-0000-4000-8000-000000000008','oldschoolossi','Ossi Virtanen','Traditional methods, little ingredients.','expert','Tampere'),
 (9,'11111111-0000-4000-8000-000000000009','newbieneil','Neil Banerjee','Just started. Asking lots of questions.','beginner','Manchester'),
 (10,'11111111-0000-4000-8000-00000000000a','rosewaterreiko','Reiko Tanaka','Floral and tea-inspired profiles.','intermediate','Amsterdam'),
 (11,'11111111-0000-4000-8000-00000000000b','modcait','Caitlin Brandt','Community moderator (demo).','advanced','Antwerp'),
 (12,'11111111-0000-4000-8000-00000000000c','labadmin','Lab Admin','Site administrator (demo).','expert','Rotterdam');
insert into auth.users (id, email, raw_user_meta_data)
select id, username || '@demo.invalid', jsonb_build_object('username', username, 'age_ack', 'true') from seed_users;
update profiles p set display_name = s.display, bio = s.bio, experience_level = s.level, location = s.loc,
       age_acknowledged_at = now() from seed_users s where s.id = p.id;
update user_roles set role = 'moderator' where user_id = (select id from seed_users where idx = 11);
update user_roles set role = 'admin' where user_id = (select id from seed_users where idx = 12);

-- ───────────────────────── recipe builder ─────────────────────────
-- liquids: 'category:Name:weight_g|...'; aromas: 'flavour-slug:aroma-slug:pct:role|...'
create or replace function pg_temp.mk_recipe(
  p_slug text, p_title text, p_creator int, p_family text, p_tob_slug text, p_tob_w numeric, p_washed boolean,
  p_liquids text, p_aromas text, p_rest_h int, p_profiles text, p_tags text, p_desc text, p_chars text,
  p_days_ago int, p_diff int default 2
) returns uuid language plpgsql as $$
declare
  rid uuid := gen_random_uuid(); creator uuid; tob tobaccos%rowtype; lt text; brand text;
  liq_total numeric := 0; sum_pct numeric := 0; batch numeric; item text; parts text[]; n int := 0;
  ch int[] := string_to_array(p_chars, ',')::int[]; v recipe_versions%rowtype; r recipes%rowtype;
  stp int := 0; cat text; wt numeric; gl numeric := 0; sw numeric := 0;
begin
  select id into creator from seed_users where idx = p_creator;
  select t.* into tob from tobaccos t where t.slug = p_tob_slug;
  select b.name into brand from tobacco_brands b where b.id = tob.brand_id;
  select l.name into lt from tobacco_leaf_types l where l.id = tob.leaf_type_id;
  foreach item in array string_to_array(p_liquids, '|') loop
    liq_total := liq_total + split_part(item, ':', 3)::numeric;
  end loop;
  foreach item in array string_to_array(p_aromas, '|') loop
    sum_pct := sum_pct + split_part(item, ':', 3)::numeric;
  end loop;
  batch := round((p_tob_w + liq_total) / (1 - sum_pct / 100.0), 1);

  insert into recipes (id, slug, creator_id, title, short_description, long_description, status, visibility,
     target_batch_weight, actual_final_weight, units, tobacco_id, tobacco_weight, tobacco_brand, tobacco_product_name,
     tobacco_leaf_family, tobacco_leaf_type, tobacco_variety, tobacco_origin, tobacco_cut, tobacco_strength_category,
     washed, wash_method, wash_duration_minutes, drying_method, drying_duration_minutes,
     initial_rest_hours, recommended_rest_hours, rest_temperature_c, mixing_schedule, storage_method,
     creator_strength, creator_sweetness, creator_flavour_intensity, creator_cooling, creator_cloud, creator_heat_tolerance,
     difficulty, creator_notes, completeness, is_demo, published_at, created_at, equipment)
  values (rid, p_slug, creator, p_title, p_desc,
     p_desc || ' (Demo recipe — fictional ingredients; not a safety or quality claim.)', 'published', 'public',
     batch, round(batch * 0.985, 1), 'g', tob.id, p_tob_w, brand, tob.product_name,
     p_family, lt, tob.variety, tob.origin, tob.cut,
     case ch[1] when 1 then 'mild' when 2 then 'mild' when 3 then 'medium' when 4 then 'strong' else 'very_strong' end,
     p_washed, case when p_washed then 'Cold water rinse, squeezed' end, case when p_washed then 45 end,
     case when p_washed then 'Air dried on mesh' end, case when p_washed then 720 end,
     p_rest_h, greatest(p_rest_h, 24), 20, case when p_rest_h >= 48 then 'Stir once a day' else 'Stir after 12 h' end,
     'Airtight glass jar, cool and dark',
     ch[1], ch[2], ch[3], ch[4], ch[5], ch[6], p_diff,
     'Weights measured on a 0.01 g scale. Results vary with leaf moisture.',
     60 + (random() * 35)::int, true, now() - make_interval(days => p_days_ago), now() - make_interval(days => p_days_ago),
     '["glass mixing bowl", "0.01 g scale"]'::jsonb)
  returning * into r;

  foreach item in array string_to_array(p_liquids, '|') loop
    parts := string_to_array(item, ':'); wt := parts[3]::numeric; n := n + 1;
    insert into recipe_base_ingredients (recipe_id, position, category, ingredient_id, name, weight_g, density_g_per_ml,
        pct_of_batch, pct_of_tobacco, notes)
    select rid, n, parts[1]::base_ingredient_category,
           (select id from ingredients i where i.category = parts[1]::base_ingredient_category limit 1),
           parts[2], wt, (select density_g_per_ml from ingredients i where i.category = parts[1]::base_ingredient_category limit 1),
           round(wt / batch * 100, 3), round(wt / p_tob_w * 100, 3), null;
  end loop;

  n := 0;
  foreach item in array string_to_array(p_aromas, '|') loop
    parts := string_to_array(item, ':'); n := n + 1;
    insert into recipe_aromas (recipe_id, position, aroma_id, brand, flavour_id, flavour_name, concentrate_name,
        weight_g, pct_of_batch, manufacturer_recommended_pct, role)
    select rid, n, a.id, b.name, f.id, f.name, a.product_name, round(parts[3]::numeric / 100 * batch, 3),
           parts[3]::numeric, a.recommended_max_pct, parts[4]::aroma_role
    from aromas a join aroma_brands b on b.id = a.brand_id
    join aroma_flavours af on af.aroma_id = a.id join flavours f on f.id = af.flavour_id
    where a.slug = parts[2];
  end loop;

  -- process steps depend on the recipe's structure (no single method is enforced)
  if p_washed then
    stp := stp + 1; insert into recipe_steps (recipe_id, step_number, category, title, instructions, duration_minutes, temperature, temperature_unit)
      values (rid, stp, 'washing', 'Wash the leaf', 'Rinse the leaf in cold water until the runoff is clear, then squeeze gently.', 45, 15, 'C');
    stp := stp + 1; insert into recipe_steps (recipe_id, step_number, category, title, instructions, duration_minutes)
      values (rid, stp, 'drying', 'Dry to damp', 'Spread on mesh and air dry until damp but not wet.', 720);
  else
    stp := stp + 1; insert into recipe_steps (recipe_id, step_number, category, title, instructions)
      values (rid, stp, 'leaf_preparation', 'Prepare the leaf', 'Loosen the leaf by hand and remove stems.');
  end if;
  stp := stp + 1; insert into recipe_steps (recipe_id, step_number, category, title, instructions)
    values (rid, stp, 'sweetener', 'Add the liquids', 'Combine glycerin and sweeteners first, then work them evenly into the leaf.');
  stp := stp + 1; insert into recipe_steps (recipe_id, step_number, category, title, instructions)
    values (rid, stp, 'flavouring', 'Add the aromas', 'Mix the aromas into a small portion of liquid first, then incorporate.');
  stp := stp + 1; insert into recipe_steps (recipe_id, step_number, category, title, instructions, duration_minutes, temperature, temperature_unit)
    values (rid, stp, 'resting', 'Rest', 'Seal and rest. Stir as described in the maturation notes.', p_rest_h * 60, 20, 'C');

  insert into recipe_sources (recipe_id, position, title, source_type, description)
  values (rid, 1, 'Personal experiment log', 'personal_experiment', 'Developed over several test batches (demo).');
  if p_rest_h >= 72 then
    insert into recipe_sources (recipe_id, position, title, source_type, url, description, accessed_on)
    values (rid, 2, 'Example forum thread on long rests (demo link)', 'forum', 'https://example.com/demo-long-rest', 'Placeholder reference for demo data.', current_date - 30);
  end if;

  insert into recipe_flavour_profiles select rid, fp.id from flavour_profiles fp where fp.slug = any(string_to_array(p_profiles, ','));
  insert into recipe_tags select rid, t.id from tags t where t.slug = any(string_to_array(p_tags, ','));

  select * into r from recipes where id = rid;
  insert into recipe_versions (recipe_id, version_major, version_minor, snapshot, created_by, created_at)
    values (rid, 1, 0, recipe_snapshot(r), creator, r.published_at) returning * into v;
  update recipes set current_version_id = v.id where id = rid;
  return rid;
end $$;

-- ───────────────────────── 25 demo recipes ─────────────────────────
-- chars = strength,sweetness,intensity,cooling,cloud,heat tolerance
select pg_temp.mk_recipe('simple-double-apple','Simple Double Apple',8,'blonde','kestrel-bright-virginia',100,false,'vegetable_glycerin:Vegetable glycerin:35','apple:copper-still-double-apple:6:primary',24,'fruity,traditional,sweet','classic,minimal,beginner-friendly','The two-ingredient baseline: leaf, glycerin, one aroma.','2,3,3,1,3,3',200,1);
select pg_temp.mk_recipe('blueberry-vanilla-cloud','Blueberry Vanilla Cloud',1,'blonde','kestrel-bright-virginia',100,true,'vegetable_glycerin:Vegetable glycerin:40|invert_syrup:Invert sugar syrup:8','blueberry:aurelia-blueberry-burst:4:primary|vanilla:aurelia-vanilla-silk:1.5:secondary|mint:nordlicht-cool-mint:0.5:cooling',72,'berry,creamy,dessert,fresh','washed-leaf,layered,high-cloud','Three-aroma berry-cream with a whisper of mint, on washed Virginia.','2,4,4,2,5,3',180,3);
select pg_temp.mk_recipe('dark-coffee-caramel','Dark Coffee Caramel',4,'dark','ember-dark-kentucky',100,false,'vegetable_glycerin:Vegetable glycerin:30|molasses:Dark molasses:25','coffee:harbor-coffee-roast:3.5:primary|caramel:salt-sugar-salted-caramel:3:secondary',96,'dessert,bakery,earthy,beverage','molasses-based,long-rest','A heavy dessert blend on dark Kentucky with molasses.','5,4,4,1,3,5',170,3);
select pg_temp.mk_recipe('honey-peach-orchard','Honey Peach Orchard',5,'blonde','marrow-lane-honey-virginia',100,false,'honey:Wildflower honey:25|vegetable_glycerin:Vegetable glycerin:30','peach:oasis-peach-orchard:4:primary|cream:salt-sugar-cream-whip:1:modifier',48,'fruity,sweet,creamy','honey-based,summer','Honey-forward peach with a soft cream finish.','2,5,3,1,3,3',150,2);
select pg_temp.mk_recipe('lemon-lime-sparkler','Lemon-Lime Sparkler',3,'blonde','kestrel-pale-burley',100,true,'vegetable_glycerin:Vegetable glycerin:33|invert_syrup:Invert sugar syrup:6','lemon:lumen-lemon-zest:3:primary|lime:lumen-lime-twist:2:secondary|menthol:nordlicht-menthol-ice:0.2:cooling',24,'citrus,fresh,sour,cooling','washed-leaf,summer,low-cooling','Crisp citrus pair with a trace of cooling.','2,2,4,3,3,2',140,2);
select pg_temp.mk_recipe('molasses-grape-mint','Molasses Grape Mint',2,'dark','ember-fire-cured',100,false,'molasses:Dark molasses:30|vegetable_glycerin:Vegetable glycerin:25','grape:copper-still-grape-nectar:4:primary|mint:nordlicht-cool-mint:0.8:cooling',120,'fruity,fresh,sweet,complex','molasses-based,long-rest','Fire-cured leaf lifted by grape and mint after a five-day rest.','4,4,4,3,2,5',130,3);
select pg_temp.mk_recipe('watermelon-ice','Watermelon Ice',7,'blonde','quarry-golden-leaf',100,false,'vegetable_glycerin:Vegetable glycerin:36','watermelon:oasis-watermelon-slice:5:primary|menthol:nordlicht-menthol-ice:0.3:cooling',36,'fruity,cooling,fresh','summer,beginner-friendly','Light watermelon over a menthol edge.','2,3,3,4,3,3',120,1);
select pg_temp.mk_recipe('strawberry-cream-dream','Strawberry Cream Dream',9,'blonde','kestrel-bright-virginia',100,false,'vegetable_glycerin:Vegetable glycerin:34|honey:Wildflower honey:6','strawberry:harbor-strawberry-field:4:primary|cream:salt-sugar-cream-whip:2:secondary|vanilla:aurelia-vanilla-silk:0.8:accent',48,'berry,creamy,dessert,sweet','beginner-friendly,honey-based','A first-attempt layered recipe that worked.','1,4,3,1,3,2',110,2);
select pg_temp.mk_recipe('orange-cinnamon-winter','Orange Cinnamon Winter',3,'blonde','quarry-heavy-burley',100,false,'vegetable_glycerin:Vegetable glycerin:32|honey:Wildflower honey:10','orange:lumen-orange-peel:3:primary|cinnamon:harbor-cinnamon-stick:0.8:accent',72,'citrus,spiced,sweet,complex','winter,honey-based','Warm spice against bright peel.','3,3,4,1,3,3',100,2);
select pg_temp.mk_recipe('rose-lemon-tea-house','Rose Lemon Tea House',10,'other','sundial-aegean-oriental',100,true,'vegetable_glycerin:Vegetable glycerin:28|invert_syrup:Invert sugar syrup:10','rose:verdant-rose-garden:0.5:primary|lemon:lumen-lemon-zest:2:secondary',48,'floral,citrus,traditional,experimental','washed-leaf,minimal','Delicate oriental leaf with rose and a lemon lift.','1,2,2,1,2,2',95,3);
select pg_temp.mk_recipe('mango-pineapple-tropic','Mango Pineapple Tropic',6,'blonde','kestrel-bright-virginia',100,false,'vegetable_glycerin:Vegetable glycerin:42|invert_syrup:Invert sugar syrup:5','mango:oasis-mango-sun:3.5:primary|pineapple:harbor-pineapple-cove:3:primary|lime:lumen-lime-twist:0.7:accent',48,'tropical,fruity,sweet','high-cloud,summer','High-glycerin tropical blend tuned for clouds.','2,4,4,1,5,2',90,2);
select pg_temp.mk_recipe('blackcurrant-menthol','Blackcurrant Menthol',7,'dark','marrow-lane-black-reserve',100,false,'vegetable_glycerin:Vegetable glycerin:28|molasses:Dark molasses:18','blackcurrant:verdant-blackcurrant:3:primary|menthol:nordlicht-menthol-ice:0.4:cooling',72,'berry,cooling,complex','molasses-based','Tart cassis with a cold finish on a robust dark base.','4,3,4,5,3,4',85,3);
select pg_temp.mk_recipe('plain-leaf-vg-only','Minimal Leaf + VG (No Aroma Variation Test)',8,'blonde','quarry-golden-leaf',100,false,'vegetable_glycerin:Vegetable glycerin:30','apple:copper-still-double-apple:2:primary',12,'traditional,fruity','minimal,classic','Test baseline with a very low aroma load.','2,2,2,1,2,3',80,1);
select pg_temp.mk_recipe('triple-berry-layered','Triple Berry Layered',1,'blonde','kestrel-pale-burley',100,true,'vegetable_glycerin:Vegetable glycerin:38|honey:Wildflower honey:10|invert_syrup:Invert sugar syrup:4','blueberry:aurelia-blueberry-burst:2.5:primary|strawberry:harbor-strawberry-field:2:secondary|blackcurrant:verdant-blackcurrant:1.2:accent|cream:salt-sugar-cream-whip:0.8:modifier',96,'berry,fruity,creamy,complex','layered,long-rest,washed-leaf','Four-aroma berry stack with careful dosing and a four-day rest.','2,4,5,1,4,3',75,4);
select pg_temp.mk_recipe('smoky-caramel-cinnamon','Smoky Caramel Cinnamon',4,'dark','ember-fire-cured',100,false,'vegetable_glycerin:Vegetable glycerin:26|molasses:Dark molasses:22','caramel:salt-sugar-salted-caramel:3.5:primary|cinnamon:harbor-cinnamon-stick:0.6:accent|coffee:harbor-coffee-roast:1.5:secondary',144,'dessert,spiced,bakery,woody','molasses-based,long-rest,winter','Six-day rest, smoky and warm.','5,4,4,1,2,5',70,4);
select pg_temp.mk_recipe('grape-apple-fusion','Grape Apple Fusion',3,'blonde','quarry-golden-leaf',100,false,'vegetable_glycerin:Vegetable glycerin:34|invert_syrup:Invert sugar syrup:6','grape:copper-still-grape-nectar:3:primary|apple:copper-still-double-apple:3:secondary',36,'fruity,sweet','classic','Two classic fruit aromas at equal weight.','2,4,3,1,3,3',65,2);
select pg_temp.mk_recipe('lime-mint-refresher','Lime Mint Refresher',7,'blonde','kestrel-bright-virginia',100,true,'vegetable_glycerin:Vegetable glycerin:34','lime:lumen-lime-twist:2.5:primary|mint:nordlicht-cool-mint:1:cooling',24,'citrus,fresh,herbal,cooling','washed-leaf,summer','Straightforward lime and mint with a washed leaf.','2,2,3,4,3,2',60,2);
select pg_temp.mk_recipe('vanilla-honey-cream','Vanilla Honey Cream',5,'blonde','marrow-lane-honey-virginia',100,false,'honey:Wildflower honey:20|vegetable_glycerin:Vegetable glycerin:28','vanilla:aurelia-vanilla-silk:2.5:primary|cream:salt-sugar-cream-whip:2:secondary',60,'creamy,dessert,sweet','honey-based,beginner-friendly','Soft, sweet and calm.','1,5,3,1,3,2',55,1);
select pg_temp.mk_recipe('peach-mango-nectar','Peach Mango Nectar',6,'blonde','kestrel-pale-burley',100,false,'vegetable_glycerin:Vegetable glycerin:40|honey:Wildflower honey:8','peach:oasis-peach-orchard:3:primary|mango:oasis-mango-sun:2.5:secondary',48,'fruity,tropical,sweet','honey-based,high-cloud','Juicy stone fruit and mango.','2,4,4,1,4,3',50,2);
select pg_temp.mk_recipe('coffee-vanilla-latte','Coffee Vanilla Latte',9,'dark','marrow-lane-black-reserve',100,false,'vegetable_glycerin:Vegetable glycerin:28|molasses:Dark molasses:15','coffee:harbor-coffee-roast:3:primary|vanilla:aurelia-vanilla-silk:1.5:secondary|cream:salt-sugar-cream-whip:1:modifier',72,'beverage,creamy,dessert','molasses-based','Café-style dark blend; beginner attempt with notes.','4,3,3,1,3,4',40,2);
select pg_temp.mk_recipe('orange-vanilla-creamsicle','Orange Vanilla Creamsicle',3,'blonde','kestrel-bright-virginia',100,false,'vegetable_glycerin:Vegetable glycerin:34|invert_syrup:Invert sugar syrup:8','orange:lumen-orange-peel:3:primary|vanilla:aurelia-vanilla-silk:1.5:secondary|cream:salt-sugar-cream-whip:1.5:secondary',48,'citrus,creamy,dessert,sweet','layered','Dairy-dessert nostalgia in three aromas.','2,4,4,1,3,3',30,3);
select pg_temp.mk_recipe('experimental-rose-blackcurrant','Experimental Rose Blackcurrant',10,'other','sundial-perique-blend',100,true,'vegetable_glycerin:Vegetable glycerin:26|honey:Wildflower honey:8|water:Distilled water:4','rose:verdant-rose-garden:0.3:accent|blackcurrant:verdant-blackcurrant:2.5:primary|mint:nordlicht-cool-mint:0.3:cooling',96,'floral,berry,experimental,complex','washed-leaf,layered,long-rest','Perique accent leaf, a little water added, and a trace of rose.','3,3,4,2,2,3',20,5);
select pg_temp.mk_recipe('watermelon-mint-cooler','Watermelon Mint Cooler',7,'blonde','quarry-golden-leaf',100,true,'vegetable_glycerin:Vegetable glycerin:37','watermelon:oasis-watermelon-slice:5:primary|mint:nordlicht-cool-mint:0.8:cooling|lemon:lumen-lemon-zest:0.7:accent',36,'fruity,fresh,cooling','washed-leaf,summer','Summer drink in leaf form.','2,3,4,4,3,3',12,2);
select pg_temp.mk_recipe('brown-sugar-molasses-chai','Molasses Chai-Style',2,'dark','ember-dark-kentucky',100,false,'molasses:Dark molasses:32|vegetable_glycerin:Vegetable glycerin:20','cinnamon:harbor-cinnamon-stick:0.8:primary|caramel:salt-sugar-salted-caramel:2:secondary|vanilla:aurelia-vanilla-silk:1:accent',168,'spiced,dessert,traditional','molasses-based,long-rest,winter','Seven-day rest, molasses-led.','5,5,3,1,2,5',6,4);

select pg_temp.mk_recipe('strawberry-lemon-sorbet','Strawberry Lemon Sorbet',3,'blonde','kestrel-bright-virginia',100,true,'vegetable_glycerin:Vegetable glycerin:35|invert_syrup:Invert sugar syrup:7','strawberry:harbor-strawberry-field:3.5:primary|lemon:lumen-lemon-zest:1.5:secondary|menthol:nordlicht-menthol-ice:0.15:cooling',36,'berry,citrus,fresh,sweet','washed-leaf,summer','Sweet strawberry cut with lemon and the faintest chill.','2,3,4,2,3,3',3,2);

-- 4 recipes get a revised v1.1 / v2.0 to demonstrate version history
create or replace function pg_temp.revise(p_slug text, p_bump text, p_notes text, p_aroma_factor numeric, p_rest_add int)
returns void language plpgsql as $$
declare r recipes%rowtype; v recipe_versions%rowtype; maj int; mnr int;
begin
  select * into r from recipes where slug = p_slug;
  update recipe_aromas set pct_of_batch = round(pct_of_batch * p_aroma_factor, 3), weight_g = round(weight_g * p_aroma_factor, 3)
   where recipe_id = r.id and position = 1;
  update recipes set initial_rest_hours = initial_rest_hours + p_rest_add,
         recommended_rest_hours = recommended_rest_hours + p_rest_add where id = r.id;
  if p_bump = 'major' then maj := r.version_major + 1; mnr := 0; else maj := r.version_major; mnr := r.version_minor + 1; end if;
  update recipes set version_major = maj, version_minor = mnr, updated_at = now() where id = r.id;
  select * into r from recipes where id = r.id;
  insert into recipe_versions (recipe_id, version_major, version_minor, change_notes, snapshot, created_by)
    values (r.id, maj, mnr, p_notes, recipe_snapshot(r), r.creator_id) returning * into v;
  update recipes set current_version_id = v.id where id = r.id;
end $$;
select pg_temp.revise('blueberry-vanilla-cloud', 'minor', 'Reduced blueberry aroma from 5% to 4% and extended the rest by 24 hours.', 0.8, 24);
select pg_temp.revise('dark-coffee-caramel', 'minor', 'Trimmed coffee from 4.4% to 3.5%; slightly longer rest.', 0.8, 24);
select pg_temp.revise('triple-berry-layered', 'minor', 'Lowered the primary aroma to let the accent show.', 0.9, 0);
select pg_temp.revise('triple-berry-layered', 'major', 'Rebalanced the layer order and added a 96 h rest (v2).', 1.0, 24);

-- ───────────────────────── interaction: reviews, experiments, likes, saves, comments ─────────────────────────
do $$
declare
  rc record; u record; bias numeric; rating int; ms maker_status; n_rev int; exp_id uuid; ver_maj int; ver_min int;
begin
  for rc in select id, slug, creator_id, version_major, version_minor, published_at from recipes where is_demo loop
    bias := 0.35 + random() * 0.55;                           -- per-recipe quality bias
    n_rev := (random() * 7)::int;
    for u in select id from seed_users where id <> rc.creator_id order by random() limit n_rev loop
      rating := greatest(1, least(5, round(1 + 4 * (bias + (random() - 0.5) * 0.5))::int));
      ms := (array['made_exactly','made_modified','not_made'])[1 + (random() * 2)::int];
      insert into recipe_reviews (recipe_id, user_id, maker_status, overall, flavour, balance, ease, cloud, heat_tolerance,
          body, version_major, version_minor, created_at)
      values (rc.id, u.id, ms, rating, greatest(1, least(5, rating + (random() * 2 - 1)::int)),
          greatest(1, least(5, rating + (random() * 2 - 1)::int)), 1 + (random() * 4)::int, 1 + (random() * 4)::int,
          1 + (random() * 4)::int,
          (array['Held up well after the full rest.','A bit sweet for me, but a solid recipe.','Needed an extra day before it came together.',
                 'Clear flavour, clean finish. Would adjust the cooling.','Not what I expected from the description.',
                 'Good starting point; I tweaked the glycerin.'])[1 + (random() * 5)::int],
          rc.version_major, rc.version_minor, rc.published_at + make_interval(hours => (random() * 400)::int));
      if ms <> 'not_made' then
        insert into recipe_experiments (recipe_id, user_id, version_major, version_minor, made_on, batch_size, followed_exactly,
            overall, flavour_accuracy, flavour_intensity, sweetness, strength, cloud_output, heat_tolerance,
            would_make_again, notes, visibility, created_at)
        values (rc.id, u.id, rc.version_major, rc.version_minor, (rc.published_at + make_interval(days => 3 + (random() * 20)::int))::date,
            50 + (random() * 150)::int, ms = 'made_exactly', rating, 1 + (random() * 4)::int, 1 + (random() * 4)::int,
            1 + (random() * 4)::int, 1 + (random() * 4)::int, 1 + (random() * 4)::int, 1 + (random() * 4)::int,
            case when rating >= 4 then 'yes' when rating = 3 then 'maybe' else 'no' end::make_again,
            (array['Followed it to the gram.','Rested a day longer than listed.','Used a different brand of glycerin.','Halved the batch.'])[1 + (random() * 3)::int],
            'public', rc.published_at + make_interval(days => 4 + (random() * 25)::int))
        returning id into exp_id;
        if ms = 'made_modified' then
          insert into experiment_changes (experiment_id, kind, description) values
            (exp_id, (array['quantity','aroma','resting_time','ingredient'])[1 + (random() * 3)::int],
             (array['Reduced the primary aroma by about 0.5%.','Swapped honey for invert syrup.','Rested 24 h longer.','Added a pinch of salt water.'])[1 + (random() * 3)::int]);
        end if;
      end if;
    end loop;
    -- likes and saves
    insert into recipe_likes (recipe_id, user_id) select rc.id, id from seed_users where id <> rc.creator_id and random() < bias * 0.6 on conflict do nothing;
    insert into recipe_saves (recipe_id, user_id) select rc.id, id from seed_users where id <> rc.creator_id and random() < bias * 0.35 on conflict do nothing;
    insert into recipe_view_daily (recipe_id, day, views)
      select rc.id, d::date, (random() * 40 * bias)::int + 1
      from generate_series(current_date - 30, current_date, interval '1 day') d where random() < 0.6 on conflict do nothing;
    update recipes set view_count = (select coalesce(sum(views), 0) from recipe_view_daily where recipe_id = rc.id) where id = rc.id;
  end loop;
end $$;

-- comment threads on a handful of recipes (creator replies included)
do $$
declare rc record; root_id uuid; commenter uuid; k int := 0;
begin
  for rc in select id, creator_id, published_at from recipes where is_demo order by random() limit 12 loop
    select id into commenter from seed_users where id <> rc.creator_id order by random() limit 1;
    insert into comments (recipe_id, user_id, body, created_at) values
      (rc.id, commenter, (array['How long did you rest this before the first bowl?','Could I swap the honey for invert syrup?',
       'Tried this last weekend — **really** clean. Thanks for sharing the weights.','Is the wash step essential here?'])[1 + (random() * 3)::int],
       rc.published_at + make_interval(days => 2 + k))
      returning id into root_id;
    insert into comments (recipe_id, parent_id, user_id, body, created_at)
      values (rc.id, root_id, rc.creator_id, 'Thanks for asking! See the maturation notes; I usually wait at least the recommended rest.',
              rc.published_at + make_interval(days => 3 + k));
    if k % 3 = 0 then
      insert into comments (recipe_id, parent_id, user_id, body, created_at)
        select rc.id, id, commenter, 'That makes sense, will report back after my next batch.', rc.published_at + make_interval(days => 4 + k)
        from comments where parent_id = root_id limit 1;
    end if;
    k := k + 1;
  end loop;
end $$;

-- ───────────────────────── forum topics (10) ─────────────────────────
create or replace function pg_temp.mk_topic(p_slug text, p_cat text, p_author int, p_title text, p_body text, p_replies text[], p_days_ago int)
returns void language plpgsql as $$
declare tid uuid; i int := 0; rep text; author uuid; cat uuid;
begin
  select id into author from seed_users where idx = p_author;
  select id into cat from forum_categories where slug = p_cat;
  insert into forum_topics (slug, category_id, author_id, title, body, is_demo, created_at, last_activity_at)
    values (p_slug, cat, author, p_title, p_body, true, now() - make_interval(days => p_days_ago), now() - make_interval(days => p_days_ago))
    returning id into tid;
  foreach rep in array p_replies loop
    i := i + 1;
    insert into forum_posts (topic_id, author_id, body, created_at)
      select tid, id, rep, now() - make_interval(days => greatest(p_days_ago - i, 0), hours => i * 3)
      from seed_users where idx = 1 + ((p_author + i * 3) % 10);
  end loop;
  update forum_topics set last_activity_at = coalesce((select max(created_at) from forum_posts where topic_id = tid), created_at) where id = tid;
end $$;
select pg_temp.mk_topic('how-long-to-rest-fruit-blends','general',9,'How long should I rest a fruit blend before trying it?','I just finished my first batch and I can''t tell if it''s flat or just young. What rest times do you all use?',array['For light fruit I give it 24-48 hours, stirring once. Dark leaf can take far longer.','Write the rest time down per batch — comparing two batches of the same recipe taught me more than any advice.','Also check leaf moisture; a damp blend tastes dull until it equalises.'],20);
select pg_temp.mk_topic('wash-or-no-wash-blonde-leaf','tobacco-leaf',1,'Washing blonde leaf: what difference have you actually noticed?','I''ve run washed vs unwashed side by side on the same leaf and I''d like to compare notes. Anyone documenting this?',array['I log both in the recipe tool and the washed one tastes cleaner but loses some body.','Wash duration matters more than people think — 45 minutes versus 10 gave very different results.'],18);
select pg_temp.mk_topic('layering-three-aromas-without-mud','aromas-flavouring',3,'Layering three aromas without turning it to mud','My three-aroma recipes taste muddy. Do you cap total aroma percentage, or use roles like primary/accent?',array['Keep one primary, one supporting, one accent. Accent under 1% usually.','Check each manufacturer''s recommended range — they are not equally strong.','Try removing one aroma at a time to see which one is muddying it.'],16);
select pg_temp.mk_topic('molasses-vs-honey-moisture','sweeteners',2,'Molasses vs honey: moisture behaviour over a week','Anyone tracked how each sweetener behaves in the jar over seven days? Mine seems to weep with molasses.',array['Molasses is hygroscopic and thicker; try a lower initial load and add more later.','Honey crystallises if the jar gets cold — worth noting for storage.'],14);
select pg_temp.mk_topic('what-is-a-community-tested-recipe','recipes-experiments',11,'What does "Community Tested" mean on a recipe?','Quick explainer: a recipe is labelled Community Tested when several different members have logged a result for it. It is not a safety or quality guarantee.',array['Thanks, that makes sense. Does the version matter?','Yes — results are tied to the version used, so v1.1 results won''t count toward v1.0.'],12);
select pg_temp.mk_topic('harsh-after-resting-what-went-wrong','troubleshooting',4,'Harsh after a week of rest — what went wrong?','Dark blend, molasses based, rested seven days, now it''s harsh. Too much sweetener? Too little glycerin?',array['Harshness with dark leaf is often too little moisture or too hot a session. Check the heat.','Compare against a pinch of extra glycerin in a small test portion before changing the whole batch.'],10);
select pg_temp.mk_topic('scales-and-containers-setup','equipment',6,'Your scale and container setup?','Looking for suggestions on measurement accuracy. 0.01 g seems overkill for aromas but great for small trials.',array['0.01 g for aromas, 0.1 g for the rest. Glass jars with a rubber seal.','Tare the container every time and log it; saves arguments with yourself later.'],8);
select pg_temp.mk_topic('traditional-methods-reading-list','traditional',8,'Reading list for traditional preparation methods?','Compiling sources on older, simpler approaches. Please cite what you can.',array['Add publication year and country when you cite; makes comparison easier.','I attach photos of ingredient labels in my recipes as sources.'],6);
select pg_temp.mk_topic('beginner-first-recipe-checklist','beginners',9,'Beginner: what should be in my first recipe?','Feeling overwhelmed by all the fields. What is the minimum worth recording?',array['Leaf, weights, aromas with percentages, rest time, one line on how it turned out.','The completeness meter in the recipe form is a good guide — you do not need 100%.'],4);
select pg_temp.mk_topic('feature-request-ingredient-inventory','feedback',10,'Feature idea: "recipes I can make with what I have"','An inventory filter would be lovely. Is it on the roadmap?',array['Seconded.','Planned for later — for now the filters help you narrow by aroma brand.'],2);

-- ───────────────────────── backdate events for meaningful trending windows ─────────────────────────
update recipe_events e set created_at = r.published_at + make_interval(hours => (random() * greatest(extract(epoch from now() - r.published_at) / 3600.0, 1))::int)
from recipes r where r.id = e.recipe_id and r.is_demo;
-- boost recency of a few recipes so "Today / This Week" differ from "All Time"
insert into recipe_events (recipe_id, kind, weight, created_at)
select r.id, 'save', 2, now() - make_interval(hours => (random() * 20)::int)
from recipes r join generate_series(1, 6) g on true where r.slug in ('watermelon-mint-cooler','brown-sugar-molasses-chai','experimental-rose-blackcurrant');
select refresh_trending_scores();

-- featured picks
update recipes set is_featured = true, featured_at = now() where slug in ('blueberry-vanilla-cloud','dark-coffee-caramel','triple-berry-layered','honey-peach-orchard');
update forum_topics set is_featured = true where slug = 'what-is-a-community-tested-recipe';
update forum_topics set is_pinned = true where slug = 'what-is-a-community-tested-recipe';

-- a notification so the bell is not empty in the demo
-- (generated by triggers during the inserts above)

commit;
