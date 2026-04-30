import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useActionData } from "react-router";
import * as schema from "../../db/schema";
import { Icon } from "~/components";
import { login } from "~/lib/operator/auth";
import { revokeSession } from "~/lib/operator/mutations";
import {
  clearSessionCookie,
  getSessionIdFromRequest,
  setSessionCookie,
  verifySession,
} from "~/lib/operator/session";
import type { Route } from "./+types/operator.login";

export function meta() {
  return [{ title: "Operator Login | icho26" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;
  const db = drizzle(env.DB, { schema });
  const session = await verifySession(db, sessionId);
  if (session) throw redirect("/operator/dashboard");
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);

  if (url.searchParams.get("action") === "logout") {
    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) {
      const db = drizzle(env.DB, { schema });
      await revokeSession(db, sessionId, new Date().toISOString());
    }
    return redirect("/operator/login", {
      headers: { "Set-Cookie": clearSessionCookie() },
    });
  }

  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  if (!password) {
    return { error: "認証に失敗しました" } as const;
  }

  const db = drizzle(env.DB, { schema });
  const result = await login(db, password);
  if (!result.ok) {
    return { error: "認証に失敗しました" } as const;
  }

  return redirect("/operator/dashboard", {
    headers: { "Set-Cookie": setSessionCookie(result.sessionId) },
  });
}

export default function OperatorLogin() {
  const actionData = useActionData<typeof action>();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Icon name="shield_person" className="text-base text-gray-900" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-900">
            icho26 / OPERATOR
          </span>
        </div>

        <h1 className="text-base font-semibold text-gray-900">
          運営者ログイン
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          発行されたパスワードを入力してください。
        </p>

        {actionData?.error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <Icon name="login" className="text-base" />
            ログイン
          </button>
        </Form>
      </div>
    </main>
  );
}
