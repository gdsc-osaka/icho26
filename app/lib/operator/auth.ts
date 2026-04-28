import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../db/schema";
import { createSession } from "./mutations";
import { verifyPassword } from "./password";
import { getCredentials } from "./queries";
import { computeSessionExpiry, generateSessionId } from "./session";

export type LoginResult =
  | { ok: true; sessionId: string }
  | { ok: false };

export async function login(
  db: DrizzleD1Database<typeof schema>,
  password: string,
): Promise<LoginResult> {
  const cred = await getCredentials(db);
  if (!cred) return { ok: false };

  const valid = await verifyPassword(
    password,
    cred.passwordHashB64,
    cred.passwordSaltB64,
    cred.passwordIterations,
  );
  if (!valid) return { ok: false };

  const now = new Date();
  const sessionId = generateSessionId();
  await createSession(db, {
    sessionId,
    operatorId: cred.operatorId,
    expiresAt: computeSessionExpiry(now),
    createdAt: now.toISOString(),
  });

  return { ok: true, sessionId };
}
