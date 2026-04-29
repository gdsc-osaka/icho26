const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

// Cloudflare Workers' WebCrypto PBKDF2 implementation rejects iteration
// counts above 100,000 with `NotSupportedError`. The OWASP / NIST guidance
// of 600,000+ exceeds this ceiling, so we cap at the platform max. This is
// acceptable for our threat model (single shared operator account, used
// briefly during a one-off event).
export const DEFAULT_ITERATIONS = 100000;

export async function hashPassword(
  plain: string,
  saltB64: string,
  iterations: number,
): Promise<string> {
  const salt = base64ToBytes(saltB64);
  const passwordBytes = new TextEncoder().encode(plain);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_LENGTH_BITS,
  );

  return bytesToBase64(new Uint8Array(derived));
}

export async function verifyPassword(
  plain: string,
  hashB64: string,
  saltB64: string,
  iterations: number,
): Promise<boolean> {
  const computed = await hashPassword(plain, saltB64, iterations);
  return constantTimeEqual(computed, hashB64);
}

export function generateSalt(): string {
  const bytes = new Uint8Array(SALT_LENGTH_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
