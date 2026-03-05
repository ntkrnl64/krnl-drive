// ─── Hex helpers ────────────────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ─── Secure random ──────────────────────────────────────────────────────────

export function randomId(): string {
  return crypto.randomUUID();
}

export function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── Password hashing (PBKDF2) ───────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return `pbkdf2:${bytesToHex(salt)}:${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const salt = hexToBytes(parts[1]);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const computed = `pbkdf2:${parts[1]}:${bytesToHex(new Uint8Array(derived))}`;
  // Constant-time comparison
  const enc = new TextEncoder();
  const a = enc.encode(computed);
  const b = enc.encode(stored);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ─── Base32 (for TOTP) ───────────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0, value = 0;
  for (const char of clean) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// ─── TOTP ────────────────────────────────────────────────────────────────────

export function generateTOTPSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function computeTOTP(secret: string, counter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  const counterBytes = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  const key = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
  const offset = sig[19] & 0xf;
  const otp = (
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff)
  ) % 1_000_000;
  return otp.toString().padStart(6, '0');
}

export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const t = Math.floor(Date.now() / 30_000);
  for (let w = -1; w <= 1; w++) {
    if (await computeTOTP(secret, t + w) === code) return true;
  }
  return false;
}

export function buildTOTPUri(secret: string, username: string, issuer = 'KRNL Drive'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ─── Recovery codes ──────────────────────────────────────────────────────────

export function generateRecoveryCode(): string {
  const arr = crypto.getRandomValues(new Uint8Array(10));
  const hex = bytesToHex(arr);
  // Format: xxxxx-xxxxx-xxxxx-xxxxx
  return `${hex.slice(0,5)}-${hex.slice(5,10)}-${hex.slice(10,15)}-${hex.slice(15,20)}`;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = code.replace(/-/g, '').toLowerCase();
  return hashPassword(normalized);
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  const normalized = code.replace(/-/g, '').toLowerCase();
  return verifyPassword(normalized, hash);
}
