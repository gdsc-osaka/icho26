import { drizzle } from "drizzle-orm/d1";
import { redirect } from "react-router";
import { applyTransition } from "~/lib/participant/mutations";
import { findUserByGroupId } from "~/lib/participant/queries";
import { createUser } from "~/lib/shared/users";
import { setGroupIdCookie, type AppEnv } from "~/lib/participant/session";
import { startOrResume } from "~/lib/participant/transitions";
import type { Q1Order } from "~/lib/participant/types";
import type { Route } from "./+types/start.$groupId";

const GROUP_ID_PATTERN =
  /^g_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function pickQ1Order(): Q1Order {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! & 1) === 0 ? "Q1_1_FIRST" : "Q1_2_FIRST";
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { groupId } = params;
  if (!groupId || !GROUP_ID_PATTERN.test(groupId)) {
    throw redirect("/");
  }

  const db = drizzle(env.DB);
  let user = await findUserByGroupId(db, groupId);

  const now = new Date().toISOString();
  if (!user) {
    user = await createUser(db, groupId, now);
  }

  const transition = startOrResume(user, pickQ1Order(), now);
  if (transition.events.length > 0) {
    await applyTransition(db, transition.user, transition.events, null, now);
  }

  throw redirect("/q1", {
    headers: { "Set-Cookie": setGroupIdCookie(groupId) },
  });
}

export default function StartGroup() {
  return null;
}
