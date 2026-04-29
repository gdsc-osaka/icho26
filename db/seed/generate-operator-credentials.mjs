#!/usr/bin/env node
//
// Generate an `operator_credentials` row INSERT statement.
//
// Usage:
//   node db/seed/generate-operator-credentials.mjs <password>
//
// Pipe to wrangler:
//   node db/seed/generate-operator-credentials.mjs '<password>' \
//     | wrangler d1 execute icho26 --local --command -
//
// Or update db/seed/operator.sql with the printed statement before
// applying it via `wrangler d1 execute --file=...`.

import { webcrypto as crypto } from "node:crypto";

// Capped at Cloudflare Workers' PBKDF2 max (100,000). See
// app/lib/operator/password.ts for rationale.
const ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: node generate-operator-credentials.mjs <password>");
    process.exit(1);
  }

  const saltBytes = new Uint8Array(SALT_LENGTH_BYTES);
  crypto.getRandomValues(saltBytes);

  const passwordBytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH_BITS,
  );

  const hashB64 = bytesToBase64(new Uint8Array(derived));
  const saltB64 = bytesToBase64(saltBytes);
  const now = new Date().toISOString();

  process.stdout.write(
    [
      "INSERT OR REPLACE INTO operator_credentials (",
      "  operator_id, password_hash_b64, password_salt_b64, password_iterations, created_at, updated_at",
      ") VALUES (",
      `  'operator', '${hashB64}', '${saltB64}', ${ITERATIONS}, '${now}', '${now}'`,
      ");",
      "",
    ].join("\n"),
  );
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return Buffer.from(binary, "binary").toString("base64");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
