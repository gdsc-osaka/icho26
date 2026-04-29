import { drizzle } from "drizzle-orm/d1";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import {
  BackgroundFX,
  GlowButton,
  Icon,
  StageHeader,
  SystemPanel,
  TopBar,
} from "~/components";
import { listUsers } from "~/lib/operator/queries";
import { requireOperatorSession } from "~/lib/operator/session";
import { createUser } from "~/lib/shared/users";
import type { Route } from "./+types/operator.dashboard";

export function meta() {
  return [{ title: "Operator Dashboard | icho26" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const users = await listUsers(db);
  return { users };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  await requireOperatorSession(request, db);

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");

  if (intent === "create-user") {
    const groupId = `g_${crypto.randomUUID()}`;
    await createUser(db, groupId, new Date().toISOString());
    return { issuedGroupId: groupId } as const;
  }

  return null;
}

export default function OperatorDashboard() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <>
      <TopBar sessionId="OPERATOR" rightIcon="admin_panel_settings" />
      <BackgroundFX />
      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pt-20 pb-12 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <StageHeader title="OPERATOR DASHBOARD" eyebrow="進捗一覧 / GROUPS" />
          <Form method="post" action="/operator/login?action=logout">
            <GlowButton type="submit">
              <span className="inline-flex items-center gap-2">
                <Icon name="logout" className="text-sm" /> LOGOUT
              </span>
            </GlowButton>
          </Form>
        </header>

        <SystemPanel>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <Icon name="add_box" className="text-sm" />
              <h2 className="font-mono text-[10px] uppercase tracking-widest">
                NEW ID ISSUE
              </h2>
            </div>
            <Form method="post">
              <input type="hidden" name="_action" value="create-user" />
              <GlowButton type="submit">ID を発行</GlowButton>
            </Form>
            {actionData?.issuedGroupId && (
              <IssuedIdCard groupId={actionData.issuedGroupId} />
            )}
          </div>
        </SystemPanel>

        <SystemPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-on-surface-variant">
                <tr className="border-b border-cyan-900/50">
                  <th className="py-2 pr-4">groupId</th>
                  <th className="py-2 pr-4">stage</th>
                  <th className="py-2 pr-4">attempts</th>
                  <th className="py-2 pr-4">reported</th>
                  <th className="py-2 pr-4">updated</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center font-mono text-on-surface-variant"
                    >
                      no groups yet
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr
                    key={u.groupId}
                    className="border-b border-cyan-900/30 hover:bg-cyan-950/10"
                  >
                    <td className="break-all py-2 pr-4 font-mono text-on-surface">
                      {u.groupId}
                    </td>
                    <td className="py-2 pr-4 font-mono text-cyan-400">
                      {u.currentStage}
                    </td>
                    <td className="py-2 pr-4 font-mono text-on-surface">
                      {u.attemptCountTotal}
                    </td>
                    <td className="py-2 pr-4 font-mono text-on-surface">
                      {u.reportedAt ? "✓" : "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-on-surface-variant">
                      {u.updatedAt}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/operator/group/${u.groupId}`}
                        className="font-mono text-cyan-400 hover:underline"
                      >
                        詳細 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SystemPanel>
      </main>
    </>
  );
}

function IssuedIdCard({ groupId }: { groupId: string }) {
  const startUrl = `/start/${groupId}`;
  return (
    <div className="space-y-2 border border-cyan-400/40 bg-[#05070A]/80 p-3 font-mono text-sm">
      <div className="flex items-center gap-2 text-cyan-400">
        <Icon name="check_circle" filled className="text-sm" />
        <span className="text-[10px] uppercase tracking-widest">ISSUED</span>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-cyan-900">
          groupId
        </div>
        <div className="break-all text-on-surface">{groupId}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-cyan-900">
          開始 URL(相対)
        </div>
        <div className="break-all text-on-surface">{startUrl}</div>
      </div>
      <p className="text-xs leading-relaxed text-on-surface-variant">
        本番ドメインを前置して QR 生成ツールへ貼り付けてください。
      </p>
    </div>
  );
}
