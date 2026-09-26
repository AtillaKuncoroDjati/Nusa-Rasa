import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [salt, key] = (encoded || '00000000000000000000000000000000:' + '0'.repeat(128)).split(':');
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return expected.length === hash.length && timingSafeEqual(expected, hash) && Boolean(encoded);
}
export const publicUser = (user) =>
  user
    ? { id: user.id, name: user.name, email: user.email, bio: user.bio, avatar: user.avatar }
    : null;
