import crypto from 'crypto';

/**
 * Production Password Hashing using Node.js crypto.scryptSync
 * Format: <salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Timing-safe password verification
 * Supports legacy plaintext migration gracefully
 */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;

  // If hash is stored in salt:hash format
  if (storedHash.includes(':')) {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  // Fallback for legacy plaintext passwords stored during early dev
  return storedHash === password;
}
