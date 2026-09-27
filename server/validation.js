import { z } from 'zod';
export const regions = [
  'Jawa Barat',
  'Jawa Tengah',
  'Jawa Timur',
  'DKI Jakarta',
  'Sumatera Barat',
  'Bali',
  'Sulawesi Selatan',
];
const text = (min, max) => z.string().trim().min(min).max(max);
export const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const password = z.string().min(10, 'Kata sandi minimal 10 karakter.').max(128);
export const registerSchema = z.object({ name: text(2, 60), email, password });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const profileSchema = z.object({
  name: text(2, 60),
  bio: text(0, 350),
  avatar: text(0, 180),
});
export const recipeSchema = z.object({
  title: text(5, 100),
  description: text(20, 1200),
  region: z.enum(regions),
  image: text(1, 180),
  video: z
    .union([z.literal(''), z.string().regex(/^\/uploads\/[a-f0-9-]+\.(mp4|webm)$/)])
    .optional(),
  minutes: z.coerce.number().int().min(1).max(1440),
  servings: z.coerce.number().int().min(1).max(100),
  ingredients: z.array(text(2, 200)).min(1).max(50),
  steps: z.array(text(5, 1200)).min(1).max(30),
});
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const err = new Error(
      'Periksa isian formulir: ' +
        result.error.issues
          .map((i) => i.path.join('.') + ': ' + i.message)
          .slice(0, 3)
          .join('; '),
    );
    err.status = 400;
    throw err;
  }
  return result.data;
}
export function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}
