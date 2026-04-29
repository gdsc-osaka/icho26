import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useActionData } from "react-router";
import * as schema from "../../db/schema";
import {
  BackgroundFX,
  ErrorAlert,
  GlowButton,
  Icon,
  StageHeader,
  SystemPanel,
  TextInput,
  TopBar,
} from "~/components";
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
    <>
      <TopBar sessionId="OPERATOR" rightIcon="admin_panel_settings" />
      <BackgroundFX />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-20">
        <SystemPanel className="w-full">
          <div className="space-y-6">
            <StageHeader title="OPERATOR LOGIN" eyebrow="ZEUS CORP / ADMIN">
              運営者認証
            </StageHeader>
            {actionData?.error && <ErrorAlert>{actionData.error}</ErrorAlert>}
            <Form method="post" className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900"
                >
                  PASSWORD
                </label>
                <div className="flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
                  <Icon name="vpn_key" className="mr-2 text-sm text-cyan-500" />
                  <TextInput
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="border-0 focus:ring-0"
                  />
                </div>
              </div>
              <GlowButton type="submit" className="w-full">
                LOGIN
              </GlowButton>
            </Form>
          </div>
        </SystemPanel>
      </main>
    </>
  );
}
