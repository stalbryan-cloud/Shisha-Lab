import { z } from 'zod';

/** '' / undefined / null → null, otherwise Number(). Lets the same schema accept form strings and JSON numbers. */
const numOrNull = (min?: number, max?: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v)) ? null : Number(v)),
    (() => {
      let n = z.number({ invalid_type_error: 'Enter a number' }).finite();
      if (min !== undefined) n = n.min(min);
      if (max !== undefined) n = n.max(max);
      return n.nullable();
    })(),
  );
const str = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const rating = numOrNull(1, 5);
const uuidOrNull = z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional());

export const BASE_CATEGORIES = [
  'vegetable_glycerin', 'honey', 'molasses', 'invert_syrup', 'glucose_syrup', 'propylene_glycol', 'water', 'other',
] as const;
export const BASE_CATEGORY_LABELS: Record<(typeof BASE_CATEGORIES)[number], string> = {
  vegetable_glycerin: 'Vegetable glycerin (VG)', honey: 'Honey', molasses: 'Molasses', invert_syrup: 'Invert syrup',
  glucose_syrup: 'Glucose syrup', propylene_glycol: 'Propylene glycol (PG)', water: 'Water', other: 'Other',
};
export const AROMA_ROLES = ['primary', 'secondary', 'accent', 'cooling', 'sweetener', 'modifier'] as const;
export const SOURCE_TYPES = [
  'website', 'forum', 'video', 'book', 'manufacturer_doc', 'personal_experiment', 'photo', 'pdf', 'ingredient_label', 'other',
] as const;
export const SOURCE_TYPE_LABELS: Record<(typeof SOURCE_TYPES)[number], string> = {
  website: 'Website / article', forum: 'Forum discussion', video: 'Video', book: 'Book', manufacturer_doc: 'Manufacturer documentation',
  personal_experiment: 'Personal experiment', photo: 'Photo', pdf: 'PDF / document', ingredient_label: 'Ingredient label', other: 'Other',
};
export const STEP_CATEGORIES = [
  'leaf_preparation', 'washing', 'drying', 'sweetener', 'glycerin', 'flavouring', 'mixing', 'heating', 'resting', 'finishing', 'other',
] as const;
export const STEP_CATEGORY_LABELS: Record<(typeof STEP_CATEGORIES)[number], string> = {
  leaf_preparation: 'Leaf preparation', washing: 'Washing', drying: 'Drying', sweetener: 'Sweetener incorporation',
  glycerin: 'Glycerin incorporation', flavouring: 'Flavouring', mixing: 'Mixing', heating: 'Heating', resting: 'Resting',
  finishing: 'Finishing', other: 'Other',
};

export const baseIngredientSchema = z
  .object({
    category: z.enum(BASE_CATEGORIES),
    ingredient_id: uuidOrNull,
    name: z.string().trim().min(1, 'Name the ingredient').max(120),
    brand: str(80),
    weight_g: numOrNull(0, 100000),
    volume_ml: numOrNull(0, 100000),
    density_g_per_ml: numOrNull(0.1, 5),
    notes: str(500),
  })
  .refine((v) => v.weight_g !== null || v.volume_ml !== null, { message: 'Enter a weight or a volume', path: ['weight_g'] });

export const aromaSchema = z
  .object({
    aroma_id: uuidOrNull,
    flavour_id: uuidOrNull,
    brand: str(80),
    flavour_name: z.string().trim().min(1, 'Name the flavour').max(80),
    concentrate_name: str(120),
    weight_g: numOrNull(0, 10000),
    volume_ml: numOrNull(0, 10000),
    pct_of_batch: numOrNull(0, 50),
    manufacturer_recommended_pct: numOrNull(0, 50),
    role: z.enum(AROMA_ROLES).default('primary'),
    notes: str(500),
  })
  .refine((v) => v.weight_g !== null || v.volume_ml !== null || v.pct_of_batch !== null, {
    message: 'Enter a weight, volume or percentage', path: ['pct_of_batch'],
  });

export const stepSchema = z.object({
  category: z.enum(STEP_CATEGORIES).nullable().optional().transform((v) => v ?? null),
  title: z.string().trim().min(1, 'Give the step a title').max(120),
  instructions: z.string().trim().min(1, 'Describe the step').max(4000),
  duration_minutes: numOrNull(0, 525600),
  temperature: numOrNull(-50, 500),
  temperature_unit: z.enum(['C', 'F']).nullable().optional().transform((v) => v ?? null),
  photo_path: str(300),
});

export const sourceSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the source a title').max(160),
    source_type: z.enum(SOURCE_TYPES),
    url: z.preprocess((v) => (v === '' ? null : v), z.string().trim().url('Enter a full URL starting with https://').max(500).nullable().optional())
      .refine((v) => !v || /^https?:\/\//i.test(v), 'Only http(s) links are allowed')
      .transform((v) => v ?? null),
    file_path: str(300),
    file_mime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).nullable().optional().transform((v) => v ?? null),
    description: str(1000),
    accessed_on: z.preprocess((v) => (v === '' ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()).transform((v) => v ?? null),
  })
  .refine((v) => v.url || v.file_path || v.source_type === 'personal_experiment', {
    message: 'Add a link or upload a file (or choose "Personal experiment")', path: ['url'],
  });

export const recipeDraftSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(120).default(''),
  short_description: str(280),
  long_description: str(20000),
  cover_image_path: str(300),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
  units: z.enum(['g', 'kg', 'oz', 'lb']).default('g'),
  target_batch_weight: numOrNull(0.01, 1_000_000),
  actual_final_weight: numOrNull(0.01, 1_000_000),
  tobacco: z.object({
    tobacco_id: uuidOrNull,
    brand: str(80), product_name: str(120),
    leaf_family: z.enum(['blonde', 'dark', 'other']).nullable().optional().transform((v) => v ?? null),
    leaf_type: str(80), variety: str(80), origin: str(80), cut: str(40),
    strength_category: z.enum(['mild', 'medium', 'strong', 'very_strong']).nullable().optional().transform((v) => v ?? null),
    weight: numOrNull(0, 1_000_000),
    washed: z.boolean().nullable().optional().transform((v) => v ?? null),
    wash_method: str(200), wash_duration_minutes: numOrNull(0, 100000),
    drying_method: str(200), drying_duration_minutes: numOrNull(0, 100000),
    notes: str(2000),
  }).default({} as never),
  base: z.array(baseIngredientSchema).max(30).default([]),
  aromas: z.array(aromaSchema).max(40).default([]),
  steps: z.array(stepSchema).max(40).default([]),
  maturation: z.object({
    initial_rest_hours: numOrNull(0, 100000), recommended_rest_hours: numOrNull(0, 100000),
    rest_temperature_c: numOrNull(-20, 80), mixing_schedule: str(500), storage_method: str(500),
  }).default({} as never),
  characteristics: z.object({
    strength: rating, sweetness: rating, flavour_intensity: rating, cooling: rating, cloud: rating, heat_tolerance: rating,
    difficulty: rating,
  }).default({} as never),
  profile_slugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(10).default([]),
  tags: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(12).default([]),
  equipment: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  creator_notes: str(10000),
  sources: z.array(sourceSchema).max(20).default([]),
  step: z.number().int().min(1).max(10).default(1),
});
export type RecipeDraftInput = z.input<typeof recipeDraftSchema>;
export type RecipeDraft = z.output<typeof recipeDraftSchema>;

export const publishSchema = z.object({
  change_notes: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  bump: z.enum(['minor', 'major']).default('minor'),
});
