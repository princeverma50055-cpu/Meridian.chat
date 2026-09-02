import {
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Creates a password hash using Node.js scrypt.
 *
 * Stored format:
 * scrypt$<salt>$<hash>
 */
export function hashPassword(
  password: string
): string {
  if (!password) {
    throw new Error('Password is required.');
  }

  const salt = randomBytes(SALT_LENGTH).toString(
    'hex'
  );

  const derivedKey = scryptSync(
    password,
    salt,
    KEY_LENGTH
  );

  return `scrypt$${salt}$${derivedKey.toString(
    'hex'
  )}`;
}

/**
 * Verifies a plain-text password against
 * a password hash created by hashPassword().
 */
export function verifyPassword(
  password: string,
  storedHash: string
): boolean {
  if (!password || !storedHash) {
    return false;
  }

  const parts = storedHash.split('$');

  if (parts.length !== 3) {
    return false;
  }

  const [
    algorithm,
    salt,
    storedKeyHex
  ] = parts;

  if (
    algorithm !== 'scrypt' ||
    !salt ||
    !storedKeyHex
  ) {
    return false;
  }

  try {
    const storedKey = Buffer.from(
      storedKeyHex,
      'hex'
    );

    const derivedKey = scryptSync(
      password,
      salt,
      KEY_LENGTH
    );

    if (
      storedKey.length !== derivedKey.length
    ) {
      return false;
    }

    return timingSafeEqual(
      storedKey,
      derivedKey
    );
  } catch {
    return false;
  }
}
