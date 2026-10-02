/** Hand-written row shapes for the columns the app reads. Keep in sync with supabase/migrations. */

export type Role = 'user' | 'trusted_user' | 'moderator' | 'admin';
export type ModerationState = 'visible' | 'hidden' | 'removed';

export interface ProfileLite {
  id?: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
}

export interface Profile extends ProfileLite {
  id: string;
  bio: string | null;
  website: string | null;
  social_links: Record<string, string>;
  experience_level: string | null;
  pinned_recipe_id: string | null;
  show_saved: boolean;
  show_likes: boolean;
  show_location: boolean;
  is_anonymized: boolean;
  created_at: string;
}

export interface Viewer {
  id: string;
  email: string | undefined;
  profile: Profile;
  role: Role;
}

export interface RecipeCardData {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  cover_image_path: string | null;
  tobacco_leaf_family: string | null;
  tobacco_leaf_type: string | null;
  creator_strength: number | null;
  creator_sweetness: number | null;
  initial_rest_hours: number | null;
  recommended_rest_hours: number | null;
  version_major: number;
  version_minor: number;
  published_at: string | null;
  updated_at: string;
  is_featured: boolean;
  completeness: number;
  like_count: number;
  save_count: number;
  made_count: number;
  view_count: number;
  comment_count: number;
  review_count: number;
  rating_sum: number;
  bayes_rating: number;
  creator: ProfileLite | null;
  aromas: { flavour_name: string; pct_of_batch: number | null; position: number }[];
  profiles: { slug: string; name: string }[];
}

export interface RecipeRow extends Omit<RecipeCardData, 'aromas' | 'profiles' | 'creator'> {
  creator_id: string | null;
  long_description: string | null;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'unlisted' | 'private';
  moderation: ModerationState;
  target_batch_weight: number | null;
  actual_final_weight: number | null;
  units: 'g' | 'kg' | 'oz' | 'lb';
  tobacco_id: string | null;
  tobacco_weight: number | null;
  tobacco_brand: string | null;
  tobacco_product_name: string | null;
  tobacco_variety: string | null;
  tobacco_origin: string | null;
  tobacco_cut: string | null;
  tobacco_strength_category: string | null;
  washed: boolean | null;
  wash_method: string | null;
  wash_duration_minutes: number | null;
  drying_method: string | null;
  drying_duration_minutes: number | null;
  tobacco_notes: string | null;
  rest_temperature_c: number | null;
  mixing_schedule: string | null;
  storage_method: string | null;
  creator_flavour_intensity: number | null;
  creator_cooling: number | null;
  creator_cloud: number | null;
  creator_heat_tolerance: number | null;
  difficulty: number | null;
  equipment: string[];
  creator_notes: string | null;
  maker_review_count: number;
  maker_rating_sum: number;
  rating_dist: number[];
  is_demo: boolean;
  current_version_id: string | null;
}

export interface BaseIngredientRow {
  id: string; position: number; category: string; name: string; brand: string | null;
  weight_g: number | null; volume_ml: number | null; density_g_per_ml: number | null;
  pct_of_batch: number | null; pct_of_tobacco: number | null; notes: string | null;
}
export interface AromaRow {
  id: string; position: number; aroma_id: string | null; brand: string | null; flavour_id: string | null;
  flavour_name: string; concentrate_name: string | null; weight_g: number | null; volume_ml: number | null;
  pct_of_batch: number | null; manufacturer_recommended_pct: number | null; role: string; notes: string | null;
}
export interface StepRow {
  id: string; step_number: number; category: string | null; title: string; instructions: string;
  duration_minutes: number | null; temperature: number | null; temperature_unit: 'C' | 'F' | null; photo_path: string | null;
}
export interface SourceRow {
  id: string; position: number; title: string; source_type: string; url: string | null; file_path: string | null;
  file_mime: string | null; description: string | null; accessed_on: string | null;
}
export interface VersionRow {
  id: string; version_major: number; version_minor: number; change_notes: string | null; created_at: string;
}

export interface ReviewRow {
  id: string; recipe_id: string; user_id: string | null; maker_status: 'made_exactly' | 'made_modified' | 'not_made';
  overall: number; flavour: number | null; balance: number | null; ease: number | null; cloud: number | null;
  heat_tolerance: number | null; body: string | null; version_major: number | null; version_minor: number | null;
  created_at: string; updated_at: string; author: ProfileLite | null;
}
export interface ExperimentRow {
  id: string; recipe_id: string; user_id: string | null; version_major: number; version_minor: number; made_on: string;
  batch_size: number | null; followed_exactly: boolean; overall: number; flavour_accuracy: number | null;
  flavour_intensity: number | null; sweetness: number | null; strength: number | null; cloud_output: number | null;
  heat_tolerance: number | null; would_make_again: 'yes' | 'maybe' | 'no'; notes: string | null;
  visibility: 'public' | 'followers' | 'private'; created_at: string; author: ProfileLite | null;
  changes?: { kind: string; description: string }[];
}
export interface CommentRow {
  id: string; recipe_id: string; parent_id: string | null; depth: number; user_id: string | null; body: string;
  upvotes: number; moderation: ModerationState; deleted_at: string | null; edited_at: string | null; created_at: string;
  forum_topic_id: string | null; author: ProfileLite | null;
}

export interface TopicRow {
  id: string; slug: string; category_id: string; author_id: string | null; title: string; body: string;
  status: 'open' | 'locked' | 'archived' | 'removed'; is_pinned: boolean; is_featured: boolean; views: number;
  reply_count: number; upvotes: number; recipe_id: string | null; created_at: string; updated_at: string;
  last_activity_at: string; author: ProfileLite | null; category: { slug: string; name: string } | null;
  tags?: { slug: string; name: string }[];
}
export interface PostRow {
  id: string; topic_id: string; author_id: string | null; quoted_post_id: string | null; body: string; upvotes: number;
  moderation: ModerationState; created_at: string; edited_at: string | null; author: ProfileLite | null;
}

export interface NotificationRow {
  id: string; type: string; message: string | null; read_at: string | null; created_at: string;
  recipe_id: string | null; topic_id: string | null; comment_id: string | null;
  actor: ProfileLite | null; recipe: { slug: string; title: string } | null; topic: { slug: string; title: string } | null;
}

export type ReportTarget = 'recipe' | 'comment' | 'review' | 'experiment' | 'forum_topic' | 'forum_post' | 'profile';

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
