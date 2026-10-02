-- SHISHA LAB — core schema
-- Conventions: uuid PKs via gen_random_uuid(), timestamptz, snake_case, soft-delete via status columns.
-- Community history is preserved: author FKs are ON DELETE SET NULL (accounts are anonymized, not cascaded).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- SQL helper functions below reference tables defined later in this file.
set check_function_bodies = off;

-- ───────────────────────── enums ─────────────────────────
create type app_role as enum ('user', 'trusted_user', 'moderator', 'admin');
create type recipe_status as enum ('draft', 'published', 'archived');
create type recipe_visibility as enum ('public', 'unlisted', 'private');
create type moderation_state as enum ('visible', 'hidden', 'removed');
create type base_ingredient_category as enum (
  'vegetable_glycerin', 'honey', 'molasses', 'invert_syrup',
  'glucose_syrup', 'propylene_glycol', 'water', 'other'
);
create type aroma_role as enum ('primary', 'secondary', 'accent', 'cooling', 'sweetener', 'modifier');
create type source_type as enum (
  'website', 'forum', 'video', 'book', 'manufacturer_doc',
  'personal_experiment', 'photo', 'pdf', 'ingredient_label', 'other'
);
create type maker_status as enum ('made_exactly', 'made_modified', 'not_made');
create type make_again as enum ('yes', 'maybe', 'no');
create type experiment_visibility as enum ('public', 'followers', 'private');
create type topic_status as enum ('open', 'locked', 'archived', 'removed');
create type report_target as enum (
  'recipe', 'comment', 'review', 'experiment', 'forum_topic', 'forum_post', 'profile'
);
create type report_reason as enum (
  'spam', 'harassment', 'dangerous_information', 'illegal_activity',
  'commercial_selling', 'tobacco_sales', 'misleading', 'copyright', 'duplicate', 'other'
);
create type report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type notification_type as enum (
  'comment_reply', 'topic_reply', 'mention', 'recipe_reviewed', 'recipe_made',
  'recipe_commented', 'saved_recipe_new_version', 'moderation_action'
);

-- ───────────────────────── helpers ─────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── profiles & roles ─────────────────────────
create table profiles (
  -- Deleting the auth user removes the profile row; all content tables reference profiles with
  -- ON DELETE SET NULL, so recipes/comments/topics survive and render as "[deleted user]".
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 500),
  avatar_path text,
  location text check (char_length(location) <= 80),
  website text check (website is null or website ~* '^https?://'),
  social_links jsonb not null default '{}'::jsonb,
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced', 'expert')),
  pinned_recipe_id uuid,
  show_saved boolean not null default false,
  show_likes boolean not null default false,
  show_location boolean not null default true,
  notification_prefs jsonb not null default '{}'::jsonb,
  age_acknowledged_at timestamptz,
  is_anonymized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_username_trgm on profiles using gin (username gin_trgm_ops);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- Roles live in their own table so a user can never edit their own role via the profiles row.
create table user_roles (
  user_id uuid primary key references profiles(id) on delete cascade,
  role app_role not null default 'user',
  granted_by uuid references profiles(id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function current_role_name() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from user_roles where user_id = auth.uid()), 'user'::app_role)
$$;
create or replace function is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select current_role_name() in ('moderator', 'admin')
$$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select current_role_name() = 'admin'
$$;
create or replace function is_suspended(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_suspensions s
    where s.user_id = uid and s.lifted_at is null and (s.ends_at is null or s.ends_at > now())
  )
$$;

-- Auto-create profile + role when an auth user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  if char_length(uname) < 3 then uname := 'user' || substr(replace(new.id::text, '-', ''), 1, 8); end if;
  if exists (select 1 from profiles where username = uname) then
    uname := left(uname, 15) || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into profiles (id, username, age_acknowledged_at)
  values (new.id, left(uname, 24),
          case when (new.raw_user_meta_data->>'age_ack') = 'true' then now() end);
  insert into user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────── moderation tables needed by helpers ─────────────────────────
create table user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  issued_by uuid references profiles(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table user_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  issued_by uuid references profiles(id) on delete set null,
  reason text not null,
  is_permanent boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  lifted_at timestamptz,
  check (is_permanent or ends_at is not null)
);
create index user_suspensions_active on user_suspensions (user_id) where lifted_at is null;

-- ───────────────────────── taxonomy ─────────────────────────
create table flavour_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0
);
create table flavours (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  merged_into uuid references flavours(id) on delete set null,
  created_at timestamptz not null default now()
);
create table flavour_category_links (
  flavour_id uuid references flavours(id) on delete cascade,
  category_id uuid references flavour_categories(id) on delete cascade,
  primary key (flavour_id, category_id)
);
-- Generic synonym table: term resolves to a flavour or to an ingredient concept (e.g. VG).
create table flavour_synonyms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  flavour_id uuid references flavours(id) on delete cascade,
  category_id uuid references flavour_categories(id) on delete cascade,
  concept text,
  check (num_nonnulls(flavour_id, category_id, concept) = 1),
  unique (term)
);
create index flavour_synonyms_trgm on flavour_synonyms using gin (term gin_trgm_ops);
create index flavours_name_trgm on flavours using gin (name gin_trgm_ops);

create table flavour_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0
);
create table tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  name text not null
);

-- ───────────────────────── ingredient database (informational only; no commerce) ─────────────────────────
create table tobacco_brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text,
  is_demo boolean not null default false
);
create table tobacco_leaf_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  family text check (family in ('blonde', 'dark', 'other'))
);
create table tobaccos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand_id uuid references tobacco_brands(id) on delete set null,
  product_name text not null,
  leaf_type_id uuid references tobacco_leaf_types(id) on delete set null,
  variety text,
  origin text,
  cut text,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index tobaccos_origin on tobaccos (origin);

create table aroma_brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text,
  is_demo boolean not null default false
);
create table aromas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand_id uuid references aroma_brands(id) on delete set null,
  product_name text not null,
  concentration_notes text,
  recommended_min_pct numeric(5,2) check (recommended_min_pct >= 0),
  recommended_max_pct numeric(5,2) check (recommended_max_pct >= 0),
  community_notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table aroma_flavours (
  aroma_id uuid references aromas(id) on delete cascade,
  flavour_id uuid references flavours(id) on delete cascade,
  primary key (aroma_id, flavour_id)
);
create index aromas_brand on aromas (brand_id);
create table sweeteners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category base_ingredient_category not null,
  manufacturer text,
  density_g_per_ml numeric(6,3) check (density_g_per_ml > 0)
);
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category base_ingredient_category not null,
  manufacturer text,
  density_g_per_ml numeric(6,3) check (density_g_per_ml > 0),
  notes text
);

-- ───────────────────────── recipes ─────────────────────────
create table recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  creator_id uuid references profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  short_description text check (char_length(short_description) <= 280),
  long_description text check (char_length(long_description) <= 20000),
  cover_image_path text,
  status recipe_status not null default 'draft',
  visibility recipe_visibility not null default 'public',
  moderation moderation_state not null default 'visible',
  is_featured boolean not null default false,
  featured_at timestamptz,
  version_major int not null default 1,
  version_minor int not null default 0,
  current_version_id uuid,
  -- batch
  target_batch_weight numeric(10,2) check (target_batch_weight > 0),
  actual_final_weight numeric(10,2) check (actual_final_weight > 0),
  units text not null default 'g' check (units in ('g', 'kg', 'oz', 'lb')),
  -- tobacco
  tobacco_id uuid references tobaccos(id) on delete set null,
  tobacco_weight numeric(10,2) check (tobacco_weight >= 0),
  tobacco_brand text,
  tobacco_product_name text,
  tobacco_leaf_family text check (tobacco_leaf_family in ('blonde', 'dark', 'other')),
  tobacco_leaf_type text,
  tobacco_variety text,
  tobacco_origin text,
  tobacco_cut text,
  tobacco_strength_category text check (tobacco_strength_category in ('mild', 'medium', 'strong', 'very_strong')),
  washed boolean,
  wash_method text,
  wash_duration_minutes int check (wash_duration_minutes >= 0),
  drying_method text,
  drying_duration_minutes int check (drying_duration_minutes >= 0),
  tobacco_notes text,
  -- maturation
  initial_rest_hours int check (initial_rest_hours >= 0),
  recommended_rest_hours int check (recommended_rest_hours >= 0),
  rest_temperature_c numeric(4,1),
  mixing_schedule text,
  storage_method text,
  -- creator-rated result characteristics
  creator_strength smallint check (creator_strength between 1 and 5),
  creator_sweetness smallint check (creator_sweetness between 1 and 5),
  creator_flavour_intensity smallint check (creator_flavour_intensity between 1 and 5),
  creator_cooling smallint check (creator_cooling between 1 and 5),
  creator_cloud smallint check (creator_cloud between 1 and 5),
  creator_heat_tolerance smallint check (creator_heat_tolerance between 1 and 5),
  difficulty smallint check (difficulty between 1 and 5),
  equipment jsonb not null default '[]'::jsonb,
  creator_notes text check (char_length(creator_notes) <= 10000),
  completeness smallint not null default 0 check (completeness between 0 and 100),
  is_demo boolean not null default false,
  -- denormalized counters (maintained by triggers in 0003)
  like_count int not null default 0,
  save_count int not null default 0,
  made_count int not null default 0,
  view_count int not null default 0,
  comment_count int not null default 0,
  review_count int not null default 0,
  rating_sum int not null default 0,
  maker_review_count int not null default 0,
  maker_rating_sum int not null default 0,
  rating_dist int[] not null default '{0,0,0,0,0}',
  bayes_rating numeric(4,3) not null default 0,
  trending_score numeric(12,4) not null default 0,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (status <> 'published' or published_at is not null)
);
create index recipes_listing on recipes (published_at desc) where status = 'published' and visibility = 'public' and moderation = 'visible';
create index recipes_creator on recipes (creator_id);
create index recipes_bayes on recipes (bayes_rating desc) where status = 'published' and visibility = 'public';
create index recipes_made on recipes (made_count desc);
create index recipes_saves on recipes (save_count desc);
create index recipes_trending on recipes (trending_score desc);
create index recipes_leaf_family on recipes (tobacco_leaf_family);
create index recipes_origin on recipes (tobacco_origin);
create index recipes_search on recipes using gin (search_tsv);
create index recipes_title_trgm on recipes using gin (title gin_trgm_ops);
create trigger recipes_updated before update on recipes for each row execute function set_updated_at();
alter table profiles add constraint profiles_pinned_recipe_fk foreign key (pinned_recipe_id) references recipes(id) on delete set null;

create table recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  version_major int not null,
  version_minor int not null,
  change_notes text check (char_length(change_notes) <= 2000),
  snapshot jsonb not null,   -- full immutable copy of recipe + child rows at publish time
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recipe_id, version_major, version_minor)
);
alter table recipes add constraint recipes_current_version_fk
  foreign key (current_version_id) references recipe_versions(id) on delete set null;

create table recipe_base_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null default 0,
  category base_ingredient_category not null,
  ingredient_id uuid references ingredients(id) on delete set null,
  name text not null,
  brand text,
  weight_g numeric(10,2) check (weight_g >= 0),
  volume_ml numeric(10,2) check (volume_ml >= 0),
  density_g_per_ml numeric(6,3) check (density_g_per_ml > 0),
  pct_of_batch numeric(6,3),
  pct_of_tobacco numeric(7,3),
  notes text,
  check (weight_g is not null or volume_ml is not null)
);
create index recipe_base_ingredients_recipe on recipe_base_ingredients (recipe_id, position);

create table recipe_aromas (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null default 0,
  aroma_id uuid references aromas(id) on delete set null,
  brand text,
  flavour_id uuid references flavours(id) on delete set null,
  flavour_name text not null,
  concentrate_name text,
  weight_g numeric(10,3) check (weight_g >= 0),
  volume_ml numeric(10,3) check (volume_ml >= 0),
  pct_of_batch numeric(6,3) check (pct_of_batch >= 0),
  manufacturer_recommended_pct numeric(5,2) check (manufacturer_recommended_pct >= 0),
  role aroma_role not null default 'primary',
  notes text,
  check (weight_g is not null or volume_ml is not null or pct_of_batch is not null)
);
create index recipe_aromas_recipe on recipe_aromas (recipe_id, position);
create index recipe_aromas_aroma on recipe_aromas (aroma_id);
create index recipe_aromas_flavour on recipe_aromas (flavour_id);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  step_number int not null,
  category text check (category in ('leaf_preparation','washing','drying','sweetener','glycerin','flavouring','mixing','heating','resting','finishing','other')),
  title text not null check (char_length(title) <= 120),
  instructions text not null check (char_length(instructions) <= 4000),
  duration_minutes int check (duration_minutes >= 0),
  temperature numeric(5,1),
  temperature_unit text check (temperature_unit in ('C', 'F')),
  photo_path text,
  unique (recipe_id, step_number) deferrable initially deferred
);

create table recipe_sources (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null default 0,
  title text not null,
  source_type source_type not null,
  url text check (url is null or url ~* '^https?://'),
  file_path text,                -- uploaded by the user (kept distinct from external url)
  file_mime text check (file_mime is null or file_mime in ('image/jpeg','image/png','image/webp','application/pdf')),
  description text,
  accessed_on date,
  check (url is not null or file_path is not null or source_type = 'personal_experiment')
);
create index recipe_sources_recipe on recipe_sources (recipe_id);

create table recipe_tags (
  recipe_id uuid references recipes(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (recipe_id, tag_id)
);
create table recipe_flavour_profiles (
  recipe_id uuid references recipes(id) on delete cascade,
  profile_id uuid references flavour_profiles(id) on delete cascade,
  primary key (recipe_id, profile_id)
);
create index recipe_flavour_profiles_profile on recipe_flavour_profiles (profile_id);

-- Autosaved wizard state (not public, one per user per draft recipe)
create table recipe_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete cascade,
  payload jsonb not null,
  step smallint not null default 1,
  updated_at timestamptz not null default now()
);
create index recipe_drafts_user on recipe_drafts (user_id, updated_at desc);

-- ───────────────────────── engagement ─────────────────────────
create table recipe_likes (
  recipe_id uuid references recipes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
create index recipe_likes_user on recipe_likes (user_id, created_at desc);
create table recipe_saves (
  recipe_id uuid references recipes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
create index recipe_saves_user on recipe_saves (user_id, created_at desc);
-- Aggregated, non-identifying view events (no per-user tracking).
create table recipe_view_daily (
  recipe_id uuid references recipes(id) on delete cascade,
  day date not null,
  views int not null default 0,
  primary key (recipe_id, day)
);
-- Event log feeding time-decayed trending (event types: like, save, comment, review, made).
create table recipe_events (
  id bigint generated always as identity primary key,
  recipe_id uuid not null references recipes(id) on delete cascade,
  kind text not null check (kind in ('like','save','comment','review','made')),
  weight numeric(4,2) not null default 1,
  created_at timestamptz not null default now()
);
create index recipe_events_recipe_time on recipe_events (recipe_id, created_at desc);
create index recipe_events_time on recipe_events (created_at desc);

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create table collection_recipes (
  collection_id uuid references collections(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

-- ───────────────────────── reviews ─────────────────────────
create table recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  version_major int,
  version_minor int,
  maker_status maker_status not null default 'not_made',
  overall smallint not null check (overall between 1 and 5),
  flavour smallint check (flavour between 1 and 5),
  balance smallint check (balance between 1 and 5),
  ease smallint check (ease between 1 and 5),
  cloud smallint check (cloud between 1 and 5),
  heat_tolerance smallint check (heat_tolerance between 1 and 5),
  body text check (char_length(body) <= 5000),
  moderation moderation_state not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, user_id)     -- one rating per account per recipe; update to change
);
create index recipe_reviews_recipe on recipe_reviews (recipe_id, created_at desc);
create index recipe_reviews_user on recipe_reviews (user_id, created_at desc);
create trigger recipe_reviews_updated before update on recipe_reviews for each row execute function set_updated_at();

-- ───────────────────────── experiments ("I Made This") ─────────────────────────
create table recipe_experiments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  version_major int not null,
  version_minor int not null,
  made_on date not null default current_date,
  batch_size numeric(10,2) check (batch_size > 0),
  followed_exactly boolean not null default true,
  overall smallint not null check (overall between 1 and 5),
  flavour_accuracy smallint check (flavour_accuracy between 1 and 5),
  flavour_intensity smallint check (flavour_intensity between 1 and 5),
  sweetness smallint check (sweetness between 1 and 5),
  strength smallint check (strength between 1 and 5),
  cloud_output smallint check (cloud_output between 1 and 5),
  heat_tolerance smallint check (heat_tolerance between 1 and 5),
  would_make_again make_again not null,
  notes text check (char_length(notes) <= 5000),
  visibility experiment_visibility not null default 'public',
  moderation moderation_state not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipe_experiments_recipe on recipe_experiments (recipe_id, created_at desc);
create index recipe_experiments_user on recipe_experiments (user_id, created_at desc);
create trigger recipe_experiments_updated before update on recipe_experiments for each row execute function set_updated_at();

create table experiment_changes (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references recipe_experiments(id) on delete cascade,
  kind text not null check (kind in ('ingredient','quantity','aroma','resting_time','process','other')),
  description text not null check (char_length(description) <= 500)
);
create index experiment_changes_exp on experiment_changes (experiment_id);
create table experiment_images (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references recipe_experiments(id) on delete cascade,
  path text not null,
  alt_text text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── comments ─────────────────────────
create table comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  depth smallint not null default 0 check (depth between 0 and 3),
  user_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  upvotes int not null default 0,
  forum_topic_id uuid,              -- "continue this discussion in Community" link
  moderation moderation_state not null default 'visible',
  deleted_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_recipe on comments (recipe_id, created_at);
create index comments_parent on comments (parent_id);
create table comment_votes (
  comment_id uuid references comments(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);

-- ───────────────────────── forum ─────────────────────────
create table forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_archived boolean not null default false
);
create table forum_category_moderators (
  category_id uuid references forum_categories(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (category_id, user_id)
);
create table forum_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category_id uuid not null references forum_categories(id),
  author_id uuid references profiles(id) on delete set null,
  title text not null check (char_length(title) between 5 and 160),
  body text not null check (char_length(body) between 1 and 20000),
  status topic_status not null default 'open',
  is_pinned boolean not null default false,
  is_featured boolean not null default false,
  views int not null default 0,
  reply_count int not null default 0,
  upvotes int not null default 0,
  recipe_id uuid references recipes(id) on delete set null,
  is_demo boolean not null default false,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index forum_topics_cat_activity on forum_topics (category_id, is_pinned desc, last_activity_at desc);
create index forum_topics_search on forum_topics using gin (search_tsv);
create index forum_topics_unanswered on forum_topics (created_at desc) where reply_count = 0;
alter table comments add constraint comments_forum_topic_fk
  foreign key (forum_topic_id) references forum_topics(id) on delete set null;

create table forum_topic_tags (
  topic_id uuid references forum_topics(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (topic_id, tag_id)
);
create table forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references forum_topics(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  quoted_post_id uuid references forum_posts(id) on delete set null,
  body text not null check (char_length(body) between 1 and 20000),
  upvotes int not null default 0,
  moderation moderation_state not null default 'visible',
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index forum_posts_topic on forum_posts (topic_id, created_at);
create index forum_posts_search on forum_posts using gin (search_tsv);
create table forum_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic_id uuid references forum_topics(id) on delete cascade,
  post_id uuid references forum_posts(id) on delete cascade,
  check (num_nonnulls(topic_id, post_id) = 1)
);
create unique index forum_votes_topic_once on forum_votes (user_id, topic_id) where topic_id is not null;
create unique index forum_votes_post_once on forum_votes (user_id, post_id) where post_id is not null;
create table forum_bookmarks (
  user_id uuid references profiles(id) on delete cascade,
  topic_id uuid references forum_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create table forum_follows (
  user_id uuid references profiles(id) on delete cascade,
  topic_id uuid references forum_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- ───────────────────────── notifications ─────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type notification_type not null,
  recipe_id uuid references recipes(id) on delete cascade,
  topic_id uuid references forum_topics(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at desc);
create index notifications_unread on notifications (user_id) where read_at is null;

-- ───────────────────────── moderation ─────────────────────────
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type report_target not null,
  target_id uuid not null,
  reason report_reason not null,
  details text check (char_length(details) <= 2000),
  status report_status not null default 'open',
  priority smallint not null default 2 check (priority between 1 and 3),
  assigned_to uuid references profiles(id) on delete set null,
  moderator_notes text,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index reports_queue on reports (status, priority, created_at);
create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  target_user_id uuid references profiles(id) on delete set null,
  reason text,
  report_id uuid references reports(id) on delete set null,
  created_at timestamptz not null default now()
);
create index moderation_actions_time on moderation_actions (created_at desc);

-- ───────────────────────── site settings ─────────────────────────
create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
-- Rate-limit ledger used by security-definer helper (see 0003)
create table rate_limits (
  user_id uuid not null,
  bucket text not null,
  hit_at timestamptz not null default now()
);
create index rate_limits_lookup on rate_limits (user_id, bucket, hit_at desc);
