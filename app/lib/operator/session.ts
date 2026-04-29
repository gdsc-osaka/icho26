import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { redirect } from "react-router";
import * as schema from "../../../db/schema";

const SESSION_COOKIE_NAME = "operator_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const SESSION_ID_LENGTH_BYTES = 32;

export function getSessionIdFromRequest(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`);
  const match = header.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setSessionCookie(sessionId: string): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

export async function verifySession(
  db: DrizzleD1Database<typeof schema>,
  sessionId: string,
): Promise<{ operatorId: string } | null> {
  const rows = await db
    .select({
      operatorId: schema.operatorSessions.operatorId,
      expiresAt: schema.operatorSessions.expiresAt,
      revokedAt: schema.operatorSessions.revokedAt,
    })
    .from(schema.operatorSessions)
    .where(eq(schema.operatorSessions.sessionId, sessionId))
    .limit(1);

  const session = rows[0];
  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt <= new Date().toISOString()) return null;
  return { operatorId: session.operatorId };
}

export async function requireOperatorSession(
  request: Request,
  db: DrizzleD1Database<typeof schema>,
): Promise<{ operatorId: string }> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) throw redirect("/operator/login");
  const session = await verifySession(db, sessionId);
  if (!session) throw redirect("/operator/login");
  return session;
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(SESSION_ID_LENGTH_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function computeSessionExpiry(now: Date): string {
  return new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
}
