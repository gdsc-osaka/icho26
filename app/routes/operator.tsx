import { drizzle } from "drizzle-orm/d1";
import { Outlet, redirect } from "react-router";
import * as schema from "../../db/schema";
import {
  getSessionIdFromRequest,
  verifySession,
} from "~/lib/operator/session";
import type { Route } from "./+types/operator";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) throw redirect("/operator/login");

  const db = drizzle(env.DB, { schema });
  const session = await verifySession(db, sessionId);
  if (!session) throw redirect("/operator/login");

  return { operatorId: session.operatorId };
}

export default function OperatorLayout() {
  return <Outlet />;
}
