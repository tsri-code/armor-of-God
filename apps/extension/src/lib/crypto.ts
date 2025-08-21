/**
 * Cryptographic utilities for PIN hashing and security
 * Uses Web Crypto API for secure operations
 */

import { CONSTANTS } from '@shared/index';

// Convert ArrayBuffer to hex string
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex string to ArrayBuffer
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) throw new Error('Invalid hex string');
  
  const byteArray = new Uint8Array(matches.map(byte => parseInt(byte, 16)));
  return byteArray.buffer;
}

// Generate cryptographically secure random bytes
export function generateRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

// Generate a salt for password hashing
export function generateSalt(): Uint8Array {
  return generateRandomBytes(CONSTANTS.CRYPTO.SALT_LENGTH);
}

// Hash a PIN using PBKDF2
export async function hashPIN(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  if (!pin || pin.length === 0) {
    throw new Error('PIN cannot be empty');
  }

  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);

  try {
    // Import the PIN as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pinData,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive key using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt,
        iterations: CONSTANTS.CRYPTO.PBKDF2_ITERATIONS,
      },
      keyMaterial,
      CONSTANTS.CRYPTO.HASH_LENGTH * 8 // bits
    );

    return new Uint8Array(derivedBits);
  } catch (error) {
    console.error('PIN hashing failed:', error);
    throw new Error('Failed to hash PIN');
  }
}

// Verify a PIN against stored hash and salt
export async function verifyPIN(pin: string, storedSaltHex: string, storedHashHex: string): Promise<boolean> {
  try {
    if (!pin || !storedSaltHex || !storedHashHex) {
      return false;
    }

    const salt = new Uint8Array(hexToArrayBuffer(storedSaltHex));
    const storedHash = new Uint8Array(hexToArrayBuffer(storedHashHex));
    
    const computedHash = await hashPIN(pin, salt);
    
    // Compare hashes using constant-time comparison
    return constantTimeEqual(computedHash, storedHash);
  } catch (error) {
    console.error('PIN verification failed:', error);
    return false;
  }
}

// Constant-time comparison to prevent timing attacks
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

// Create PIN hash data structure
export async function createPINHash(pin: string): Promise<{ saltHex: string; hashHex: string }> {
  const salt = generateSalt();
  const hash = await hashPIN(pin, salt);
  
  return {
    saltHex: arrayBufferToHex(salt.buffer),
    hashHex: arrayBufferToHex(hash.buffer),
  };
}

// Generate a secure random ID
export function generateId(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = generateRandomBytes(length);
  
  return Array.from(randomValues)
    .map(byte => chars[byte % chars.length])
    .join('');
}

// Hash a string using SHA-256 (for non-sensitive data like domain hashing)
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}

// Truncated hash for privacy (e.g., domain analytics)
export async function truncatedHash(text: string, length: number = 8): Promise<string> {
  const fullHash = await sha256(text);
  return fullHash.substring(0, length);
}

// Validate that Web Crypto is available
export function isWebCryptoSupported(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues === 'function';
}

// Initialize crypto (check support)
export function initializeCrypto(): void {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API is not supported in this environment');
  }
}

// Export utility functions for testing
export const cryptoUtils = {
  arrayBufferToHex,
  hexToArrayBuffer,
  generateRandomBytes,
  constantTimeEqual,
  isWebCryptoSupported,
};
