import crypto from 'crypto';

import env from '../config/env.config';

import { logger } from './logger';
import bcrypt from 'bcrypt';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derive a key from a password using PBKDF2
 * @param password The password to derive the key from
 * @param salt The salt to use for key derivation
 * @returns The derived key
 */
const deriveKey = (password: string, salt: Buffer): Buffer => {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
};

/**
 * Encrypt data using AES-256-GCM
 * @param data The data to encrypt
 * @param password The password to use for encryption
 * @returns The encrypted data as a string
 */
export const encrypt = (data: string): string => {
  try {
    // Generate a random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Generate a random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive the key from the password
    const key = deriveKey(env.ENCRYPTION_KEY, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

    // Get the auth tag
    const tag = cipher.getAuthTag();

    // Combine all components
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    // Return as base64 string
    return result.toString('base64');
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData The encrypted data as a string
 * @param password The password used for encryption
 * @returns The decrypted data as a string
 */
export const decrypt = (encryptedData: string): string => {
  try {
    // Convert from base64
    const buffer = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive the key from the password
    const key = deriveKey(env.ENCRYPTION_KEY, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Set the auth tag
    decipher.setAuthTag(tag);

    // Decrypt the data
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Return as string
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Decryption failed');
  }
};

/**
 * Check if a string is encrypted
 * @param data The data to check
 * @returns True if the data is encrypted, false otherwise
 */
export const isEncrypted = (data: any): boolean => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  return 'encrypted' in data && typeof data.encrypted === 'string';
};

/**
 * Helper method to hash a password
 * @param password - The password to hash
 * @returns The hashed password
 */
export const hashPassword = (password: string): Promise<string> => {
  const saltRounds = parseInt(env.BCRYPT_SALT_ROUNDS.toString(), 10);
  return bcrypt.hash(password, saltRounds);
};
