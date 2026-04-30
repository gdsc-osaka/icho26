import { drizzle } from "drizzle-orm/d1";
import { redirect } from "react-router";
import type { AppEnv } from "../shared/env";
import { findUserByGroupId } from "./queries";
import type { Stage, UserRow } from "./types";

export type { AppEnv };

const COOKIE_NAME = "group_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours
const GROUP_ID_PATTERN =
  /^g_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* ----------------------------- Cookie helpers ----------------------------- */

export function getGroupIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)group_session=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return GROUP_ID_PATTERN.test(value) ? value : null;
}

export function setGroupIdCookie(groupId: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(groupId)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
}

export function clearGroupIdCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/* --------------------------- Stage → allowed paths ------------------------ */

type StageSpec = {
  matches: (pathname: string) => boolean;
  fallback: string;
};

function stageSpec(stage: Stage): StageSpec {
  switch (stage) {
    case "START":
      return {
        matches: (p) => /^\/start\/g_[0-9a-f-]+$/.test(p),
        fallback: "/",
      };
    case "Q1":
      return {
        matches: (p) =>
          p === "/q1" ||
          p === "/q1/1" ||
          p === "/q1/2" ||
          /^\/q1\/[12]\/checkpoint$/.test(p),
        fallback: "/q1",
      };
    case "Q2":
      return {
        matches: (p) => p === "/q2" || p === "/q2/checkpoint",
        fallback: "/q2",
      };
    case "Q3_KEYWORD":
    case "Q3_CODE":
      // 単一画面 (/q3) で PHASE_01 / PHASE_02 を順次入力する
      return { matches: (p) => p === "/q3", fallback: "/q3" };
    case "Q4":
      return { matches: (p) => p === "/q4", fallback: "/q4" };
    case "FAKE_END":
    case "COMPLETE": {
      const completePaths = new Set([
        "/release",
        "/complete",
        "/complete/epilogue",
        "/complete/explain",
        "/complete/report",
      ]);
      return {
        matches: (p) => completePaths.has(p),
        fallback: stage === "FAKE_END" ? "/release" : "/complete",
      };
    }
  }
}

/* --------------------------- Guard for loaders ---------------------------- */

/**
 * Loads the participant from the session Cookie and verifies the requested
 * URL is allowed for the current stage. Throws `redirect(...)` on any
 * mismatch. The caller (loader/action) just `await`s the result.
 */
export async function requireParticipant(
  request: Request,
  env: AppEnv,
): Promise<{ user: UserRow }> {
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const pathname = new URL(request.url).pathname;
  const spec = stageSpec(user.currentStage as Stage);
  if (!spec.matches(pathname)) {
    throw redirect(spec.fallback);
  }

  return { user };
}
