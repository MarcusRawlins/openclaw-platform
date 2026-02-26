/**
 * Token Encryption/Decryption
 * Uses AES-256-GCM for secure token storage
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error(
    'ENCRYPTION_KEY not set in environment variables. ' +
    'Generate with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
  );
}

if (ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be 32 bytes (64 hex characters). ' +
    'Generate with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
  );
}

const key = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypt a token using AES-256-GCM
 * Returns iv:ciphertext:authTag in base64
 */
export function encryptToken(token: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine iv:ciphertext:authTag, all in hex
    const combined = `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;

    return Buffer.from(combined).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token
 */
export function decryptToken(encryptedToken: string): string {
  try {
    const combined = Buffer.from(encryptedToken, 'base64').toString('hex');
    const parts = combined.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const ciphertext = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Generate a secure encryption key
 * Run this once and save to ENCRYPTION_KEY environment variable
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32);
  return key.toString('hex');
}
