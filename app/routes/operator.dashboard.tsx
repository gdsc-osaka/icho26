import { drizzle } from "drizzle-orm/d1";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import { GlowButton, StageHeader, SystemPanel } from "~/components";
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
    <main className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <StageHeader title="OPERATOR DASHBOARD">進捗一覧</StageHeader>
          <Form method="post" action="/operator/login?action=logout">
            <GlowButton type="submit">LOGOUT</GlowButton>
          </Form>
        </header>

        <SystemPanel>
          <div className="space-y-3">
            <h2 className="font-display text-lg text-text-primary">
              新規 ID 発行
            </h2>
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
              <thead className="font-mono text-text-secondary">
                <tr className="border-b border-accent-dim">
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
                      className="py-4 text-center text-text-secondary font-mono"
                    >
                      no groups yet
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.groupId} className="border-b border-accent-dim/30">
                    <td className="py-2 pr-4 font-mono text-text-primary break-all">
                      {u.groupId}
                    </td>
                    <td className="py-2 pr-4 font-mono text-accent">
                      {u.currentStage}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {u.attemptCountTotal}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {u.reportedAt ? "✓" : "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-secondary text-xs">
                      {u.updatedAt}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/operator/group/${u.groupId}`}
                        className="text-accent hover:underline font-mono"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SystemPanel>
      </div>
    </main>
  );
}

function IssuedIdCard({ groupId }: { groupId: string }) {
  const startUrl = `/start/${groupId}`;
  return (
    <div className="bg-bg-primary rounded p-3 font-mono text-sm space-y-2">
      <div className="text-accent">発行済み</div>
      <div className="space-y-1">
        <div className="text-text-secondary text-xs">groupId</div>
        <div className="text-text-primary break-all">{groupId}</div>
      </div>
      <div className="space-y-1">
        <div className="text-text-secondary text-xs">開始 URL(相対)</div>
        <div className="text-text-primary break-all">{startUrl}</div>
      </div>
      <p className="text-text-secondary text-xs leading-relaxed">
        本番ドメインを前置して QR 生成ツールへ貼り付けてください。
      </p>
    </div>
  );
}
