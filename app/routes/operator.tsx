import { drizzle } from "drizzle-orm/d1";
import { Outlet } from "react-router";
import * as schema from "../../db/schema";
import { requireOperatorSession } from "~/lib/operator/session";
import type { Route } from "./+types/operator";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const session = await requireOperatorSession(request, db);
  return { operatorId: session.operatorId };
}

export default function OperatorLayout() {
  return <Outlet />;
}
