import { z } from 'zod';

const opt = (min: number, max: number) => z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(min).max(max).nullable());
const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const reviewSchema = z.object({
  recipe_id: z.string().uuid(),
  maker_status: z.enum(['made_exactly', 'made_modified', 'not_made']),
  overall: z.coerce.number().int().min(1, 'Choose a star rating').max(5),
  flavour: opt(1, 5), balance: opt(1, 5), ease: opt(1, 5), cloud: opt(1, 5), heat_tolerance: opt(1, 5),
  body: text(5000),
});

export const CHANGE_KINDS = ['ingredient', 'quantity', 'aroma', 'resting_time', 'process', 'other'] as const;
export const experimentSchema = z.object({
  recipe_id: z.string().uuid(),
  version_major: z.coerce.number().int().min(1),
  version_minor: z.coerce.number().int().min(0),
  made_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the date'),
  batch_size: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().positive().max(1_000_000).nullable()),
  followed_exactly: z.coerce.boolean(),
  overall: z.coerce.number().int().min(1, 'Rate the overall result').max(5),
  flavour_accuracy: opt(1, 5), flavour_intensity: opt(1, 5), sweetness: opt(1, 5), strength: opt(1, 5),
  cloud_output: opt(1, 5), heat_tolerance: opt(1, 5),
  would_make_again: z.enum(['yes', 'maybe', 'no']),
  notes: text(5000),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
  changes: z.array(z.object({ kind: z.enum(CHANGE_KINDS), description: z.string().trim().min(1).max(500) })).max(12).default([]),
});

export const commentSchema = z.object({
  recipe_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  body: z.string().trim().min(1, 'Write something first').max(5000),
});

export const topicSchema = z.object({
  category_id: z.string().uuid('Choose a category'),
  title: z.string().trim().min(5, 'Title needs at least 5 characters').max(160),
  body: z.string().trim().min(1, 'Write the first post').max(20000),
  tags: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(5).default([]),
  recipe_id: z.string().uuid().nullable().optional(),
});
export const postSchema = z.object({
  topic_id: z.string().uuid(),
  body: z.string().trim().min(1, 'Write something first').max(20000),
  quoted_post_id: z.string().uuid().nullable().optional(),
});

export const REPORT_REASONS = [
  'spam', 'harassment', 'dangerous_information', 'illegal_activity', 'commercial_selling', 'tobacco_sales',
  'misleading', 'copyright', 'duplicate', 'other',
] as const;
export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: 'Spam', harassment: 'Harassment', dangerous_information: 'Dangerous information', illegal_activity: 'Illegal activity',
  commercial_selling: 'Commercial selling', tobacco_sales: 'Tobacco sales / marketplace activity', misleading: 'Misleading information',
  copyright: 'Copyright issue', duplicate: 'Duplicate content', other: 'Other',
};
export const reportSchema = z.object({
  target_type: z.enum(['recipe', 'comment', 'review', 'experiment', 'forum_topic', 'forum_post', 'profile']),
  target_id: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: text(2000),
});

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export const usernameSchema = z.string().trim().toLowerCase().regex(USERNAME_RE, 'Use 3–24 lowercase letters, numbers or underscores');

export const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(254),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  username: usernameSchema,
  age_ack: z.literal('on', { errorMap: () => ({ message: 'You must confirm you are an adult to join' }) }),
  rules_ack: z.literal('on', { errorMap: () => ({ message: 'Please accept the community rules' }) }),
});
export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const profileSchema = z.object({
  username: usernameSchema,
  display_name: text(60),
  bio: text(500),
  location: text(80),
  website: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url().max(200).nullable().optional())
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Only http(s) links are allowed').transform((v) => v ?? null),
  experience_level: z.preprocess((v) => (v === '' ? null : v), z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable().optional()).transform((v) => v ?? null),
  show_saved: z.coerce.boolean().default(false),
  show_likes: z.coerce.boolean().default(false),
  show_location: z.coerce.boolean().default(true),
});

export const NOTIFICATION_TYPES = [
  ['comment_reply', 'Replies to my comments'], ['topic_reply', 'Replies to my forum topics'], ['mention', 'Mentions'],
  ['recipe_reviewed', 'Reviews of my recipes'], ['recipe_made', 'Someone made my recipe'], ['recipe_commented', 'Comments on my recipes'],
  ['saved_recipe_new_version', 'New versions of recipes I saved'], ['moderation_action', 'Moderator actions on my content'],
] as const;
