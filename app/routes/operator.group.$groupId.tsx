import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import { STAGES, type Stage } from "../../db/schema";
import { Icon } from "~/components";
import {
  CopyButton,
  LightPrinterPanel,
  OperatorShell,
  StageBadge,
} from "~/components/operator";
import { correctStatus, markReported } from "~/lib/operator/mutations";
import { getUserDetail, type UserDetail } from "~/lib/operator/queries";
import { requireOperatorSession } from "~/lib/operator/session";
import { usePrinterContext } from "~/lib/printer/printer-context";
import type { Route } from "./+types/operator.group.$groupId";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Group ${params.groupId} | Operator | icho26` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const detail = await getUserDetail(db, params.groupId);
  if (!detail) {
    throw new Response("Group not found", { status: 404 });
  }
  return detail;
}

type ActionResult =
  | { ok: true; intent: "status-correction" | "mark-reported" }
  | { ok: false; error: string };

export async function action({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const session = await requireOperatorSession(request, db);

  const existing = await db
    .select({ groupId: schema.users.groupId })
    .from(schema.users)
    .where(eq(schema.users.groupId, params.groupId))
    .limit(1);
  if (existing.length === 0) {
    throw new Response("Group not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");
  const now = new Date().toISOString();

  if (intent === "status-correction") {
    const fromStageRaw = String(formData.get("from_stage") ?? "");
    const toStage = String(formData.get("to_stage") ?? "");
    const reasonCode = String(formData.get("reason_code") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim() || null;

    if (!STAGES.includes(toStage as Stage)) {
      return { ok: false, error: "to_stage が不正です" };
    }
    if (!reasonCode) {
      return { ok: false, error: "reason_code は必須です" };
    }

    await correctStatus(db, {
      operatorId: session.operatorId,
      groupId: params.groupId,
      fromStage: STAGES.includes(fromStageRaw as Stage)
        ? (fromStageRaw as Stage)
        : null,
      toStage: toStage as Stage,
      reasonCode,
      note,
      now,
    });
    return { ok: true, intent: "status-correction" };
  }

  if (intent === "mark-reported") {
    const reasonCode = String(formData.get("reason_code") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim() || null;

    if (!reasonCode) {
      return { ok: false, error: "reason_code は必須です" };
    }

    await markReported(db, {
      operatorId: session.operatorId,
      groupId: params.groupId,
      reasonCode,
      note,
      now,
    });
    return { ok: true, intent: "mark-reported" };
  }

  return { ok: false, error: "unknown action" };
}

export default function OperatorGroupDetail() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <OperatorShell
      title={data.user.groupName ?? "（無名グループ）"}
      eyebrow="GROUP DETAIL"
      actions={
        <Link
          to="/operator/dashboard"
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          <Icon name="arrow_back" className="text-sm" />
          ダッシュボードに戻る
        </Link>
      }
    >
      {actionData?.ok && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {actionData.intent === "status-correction"
            ? "ステータスを補正しました"
            : "報告済みとしてマークしました"}
        </div>
      )}
      {actionData && !actionData.ok && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      <UserSummary user={data.user} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReprintPanel user={data.user} />
        {data.user.reportedAt === null ? (
          <MarkReportedForm />
        ) : (
          <Card title="報告済み" icon="task_alt">
            <p className="font-mono text-sm text-gray-700">
              {data.user.reportedAt}
            </p>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <StatusCorrectionForm currentStage={data.user.currentStage as Stage} />
      </div>

      <div className="mt-4 space-y-4">
        <LogSection title="試行ログ" icon="history">
          {data.attempts.length === 0 ? (
            <EmptyRow text="no attempts" />
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-[10px] font-medium uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-3 py-2">created_at</th>
                  <th className="px-3 py-2">stage</th>
                  <th className="px-3 py-2">raw</th>
                  <th className="px-3 py-2">normalized</th>
                  <th className="px-3 py-2">correct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {a.createdAt}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900">
                      {a.stage}
                    </td>
                    <td className="px-3 py-2 font-mono break-all">
                      {a.rawInput}
                    </td>
                    <td className="px-3 py-2 font-mono break-all">
                      {a.normalizedInput}
                    </td>
                    <td className="px-3 py-2">
                      {a.correct ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-red-600">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>

        <LogSection title="進行ログ" icon="track_changes">
          {data.progress.length === 0 ? (
            <EmptyRow text="no progress events" />
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-[10px] font-medium uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-3 py-2">created_at</th>
                  <th className="px-3 py-2">event_type</th>
                  <th className="px-3 py-2">from</th>
                  <th className="px-3 py-2">to</th>
                  <th className="px-3 py-2">detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.progress.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {p.createdAt}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900">
                      {p.eventType}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {p.fromStage ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">{p.toStage ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs break-all">
                      {p.detail ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>

        <LogSection title="運営介入ログ" icon="security">
          {data.actions.length === 0 ? (
            <EmptyRow text="no operator actions" />
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-[10px] font-medium uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-3 py-2">created_at</th>
                  <th className="px-3 py-2">action_type</th>
                  <th className="px-3 py-2">from</th>
                  <th className="px-3 py-2">to</th>
                  <th className="px-3 py-2">reason_code</th>
                  <th className="px-3 py-2">note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.actions.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">
                      {a.createdAt}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900">
                      {a.actionType}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {a.fromStage ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">{a.toStage ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{a.reasonCode}</td>
                    <td className="px-3 py-2 font-mono text-xs break-all">
                      {a.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>
      </div>
    </OperatorShell>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Icon name={icon} className="text-base text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function UserSummary({ user }: { user: UserDetail["user"] }) {
  return (
    <Card title="サマリ" icon="info">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <SummaryField label="グループ名" value={user.groupName ?? "—"} />
        <SummaryField label="人数" value={String(user.groupSize ?? "—")} />
        <SummaryField label="現在ステージ">
          <StageBadge stage={user.currentStage as Stage} />
        </SummaryField>
        <SummaryField label="groupId">
          <CopyButton value={user.groupId} label={shortId(user.groupId)} />
        </SummaryField>
        <SummaryField label="q1_order" value={user.q1Order ?? "—"} />
        <SummaryField
          label="q1_1 / q1_2 / q2"
          value={`${user.q1_1Cleared} / ${user.q1_2Cleared} / ${user.q2Cleared}`}
        />
        <SummaryField label="started_at" value={user.startedAt ?? "—"} />
        <SummaryField label="updated_at" value={user.updatedAt} />
        <SummaryField label="reported_at" value={user.reportedAt ?? "—"} />
        <SummaryField label="completed_at" value={user.completedAt ?? "—"} />
        <SummaryField
          label="epilogue_viewed_at"
          value={user.epilogueViewedAt ?? "—"}
        />
      </div>
    </Card>
  );
}

function SummaryField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-0.5 break-all text-sm text-gray-900">
        {children ?? value}
      </div>
    </div>
  );
}

function StatusCorrectionForm({ currentStage }: { currentStage: Stage }) {
  return (
    <Card title="ステータス補正" icon="tune">
      <Form method="post" className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="_action" value="status-correction" />
        <input type="hidden" name="from_stage" value={currentStage} />
        <FormField label="from (現在)">
          <div className="flex h-9 items-center">
            <StageBadge stage={currentStage} />
          </div>
        </FormField>
        <FormField label="to_stage">
          <select
            name="to_stage"
            required
            defaultValue={currentStage}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="reason_code">
          <input
            type="text"
            name="reason_code"
            required
            placeholder="例: NFC_FAILED, MANUAL_OVERRIDE"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </FormField>
        <FormField label="note (任意)">
          <textarea
            name="note"
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </FormField>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
          >
            補正を適用
          </button>
        </div>
      </Form>
    </Card>
  );
}

function MarkReportedForm() {
  return (
    <Card title="報告済みマーク" icon="assignment_turned_in">
      <p className="mb-3 text-sm text-gray-600">
        来場者が偽エンドに到達してスタッフに提示した後、ここで報告済みとしてマークします。
      </p>
      <Form
        method="post"
        className="space-y-3"
        onSubmit={(e) => {
          if (!confirm("報告済みとしてマークします。よろしいですか?")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="_action" value="mark-reported" />
        <FormField label="reason_code">
          <input
            type="text"
            name="reason_code"
            required
            placeholder="例: REWARD_HANDED"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </FormField>
        <FormField label="note (任意)">
          <textarea
            name="note"
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </FormField>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
        >
          報告済みにする
        </button>
      </Form>
    </Card>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function LogSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Icon name={icon} className="text-base text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-500">{text}</p>;
}

function ReprintPanel({ user }: { user: UserDetail["user"] }) {
  const { printer, assetsReady, assetError } = usePrinterContext();
  const hasMetadata = user.groupName !== null && user.groupSize !== null;
  const canPrint =
    assetsReady &&
    hasMetadata &&
    !printer.isConnecting &&
    printer.printState !== "printing";

  const handleReprint = () => {
    if (user.groupName === null || user.groupSize === null) return;
    const startUrl = `${window.location.origin}/start/${user.groupId}`;
    const print = () =>
      printer.printBadge({
        groupName: user.groupName as string,
        groupSize: user.groupSize as number,
        groupId: user.groupId,
        issuedAt: new Date(user.createdAt),
        qrUrl: startUrl,
      });
    if (printer.status.isConnected) {
      void print().catch(() => {});
    } else {
      void printer
        .connect()
        .then(print)
        .catch(() => {});
    }
  };

  return (
    <Card title="社員証 再印刷" icon="print">
      <div className="space-y-3">
        <LightPrinterPanel printer={printer} assetsReady={assetsReady} />
        {assetError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            アセットロード失敗: {assetError}
          </div>
        )}
        {!hasMetadata && (
          <p className="text-xs text-gray-500">
            このグループには社員名/人数が未登録のため再印刷できません (旧 ID)。
          </p>
        )}
        <button
          type="button"
          onClick={handleReprint}
          disabled={!canPrint}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="print" className="text-base" />
          {printer.printState === "printing" ? "印刷中..." : "再印刷"}
        </button>
      </div>
    </Card>
  );
}

function shortId(groupId: string): string {
  const tail = groupId.replace(/^g_/, "").replace(/-/g, "").slice(-8);
  return `IC-${tail.slice(0, 4).toUpperCase()}-${tail.slice(4).toUpperCase()}`;
}
