import { drizzle } from "drizzle-orm/d1";
import { Form, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import { STAGES, type Stage } from "../../db/schema";
import {
  ErrorAlert,
  GlowButton,
  StageHeader,
  SystemPanel,
  TextInput,
} from "~/components";
import { correctStatus, markReported } from "~/lib/operator/mutations";
import { getUserDetail, type UserDetail } from "~/lib/operator/queries";
import { requireOperatorSession } from "~/lib/operator/session";
import type { Route } from "./+types/operator.group.$groupId";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Group ${params.groupId} | icho26` }];
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
    <main className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <StageHeader title="GROUP DETAIL">
          {data.user.groupId}
        </StageHeader>

        {actionData?.ok && (
          <div className="bg-accent/10 border border-accent text-accent px-4 py-2 rounded font-mono text-sm">
            {actionData.intent === "status-correction"
              ? "ステータスを補正しました"
              : "報告済みとしてマークしました"}
          </div>
        )}
        {actionData && !actionData.ok && (
          <ErrorAlert>{actionData.error}</ErrorAlert>
        )}

        <UserSummary user={data.user} />

        <div className="grid md:grid-cols-2 gap-6">
          <StatusCorrectionForm currentStage={data.user.currentStage as Stage} />
          {data.user.reportedAt === null ? (
            <MarkReportedForm />
          ) : (
            <SystemPanel>
              <h2 className="font-display text-lg text-text-primary">
                報告済み
              </h2>
              <p className="font-mono text-sm text-text-secondary mt-2">
                {data.user.reportedAt}
              </p>
            </SystemPanel>
          )}
        </div>

        <LogSection title="試行ログ">
          {data.attempts.length === 0 ? (
            <EmptyRow text="no attempts" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-text-secondary">
                <tr className="border-b border-accent-dim">
                  <th className="py-2 pr-4">created_at</th>
                  <th className="py-2 pr-4">stage</th>
                  <th className="py-2 pr-4">raw</th>
                  <th className="py-2 pr-4">normalized</th>
                  <th className="py-2 pr-4">correct</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr key={a.id} className="border-b border-accent-dim/30">
                    <td className="py-2 pr-4 font-mono text-text-secondary text-xs">
                      {a.createdAt}
                    </td>
                    <td className="py-2 pr-4 font-mono text-accent">
                      {a.stage}
                    </td>
                    <td className="py-2 pr-4 font-mono break-all">
                      {a.rawInput}
                    </td>
                    <td className="py-2 pr-4 font-mono break-all">
                      {a.normalizedInput}
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {a.correct ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>

        <LogSection title="進行ログ">
          {data.progress.length === 0 ? (
            <EmptyRow text="no progress events" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-text-secondary">
                <tr className="border-b border-accent-dim">
                  <th className="py-2 pr-4">created_at</th>
                  <th className="py-2 pr-4">event_type</th>
                  <th className="py-2 pr-4">from</th>
                  <th className="py-2 pr-4">to</th>
                  <th className="py-2 pr-4">detail</th>
                </tr>
              </thead>
              <tbody>
                {data.progress.map((p) => (
                  <tr key={p.id} className="border-b border-accent-dim/30">
                    <td className="py-2 pr-4 font-mono text-text-secondary text-xs">
                      {p.createdAt}
                    </td>
                    <td className="py-2 pr-4 font-mono text-accent">
                      {p.eventType}
                    </td>
                    <td className="py-2 pr-4 font-mono">{p.fromStage ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono">{p.toStage ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono break-all text-xs">
                      {p.detail ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>

        <LogSection title="運営介入ログ">
          {data.actions.length === 0 ? (
            <EmptyRow text="no operator actions" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-text-secondary">
                <tr className="border-b border-accent-dim">
                  <th className="py-2 pr-4">created_at</th>
                  <th className="py-2 pr-4">action_type</th>
                  <th className="py-2 pr-4">from</th>
                  <th className="py-2 pr-4">to</th>
                  <th className="py-2 pr-4">reason_code</th>
                  <th className="py-2 pr-4">note</th>
                </tr>
              </thead>
              <tbody>
                {data.actions.map((a) => (
                  <tr key={a.id} className="border-b border-accent-dim/30">
                    <td className="py-2 pr-4 font-mono text-text-secondary text-xs">
                      {a.createdAt}
                    </td>
                    <td className="py-2 pr-4 font-mono text-accent">
                      {a.actionType}
                    </td>
                    <td className="py-2 pr-4 font-mono">{a.fromStage ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono">{a.toStage ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono">{a.reasonCode}</td>
                    <td className="py-2 pr-4 font-mono break-all text-xs">
                      {a.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>
      </div>
    </main>
  );
}

function UserSummary({ user }: { user: UserDetail["user"] }) {
  return (
    <SystemPanel>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
        <SummaryField label="current_stage" value={user.currentStage} highlight />
        <SummaryField label="q1_order" value={user.q1Order ?? "—"} />
        <SummaryField label="started_at" value={user.startedAt ?? "—"} />
        <SummaryField label="updated_at" value={user.updatedAt} />
        <SummaryField
          label="q1_1 / q1_2 / q2"
          value={`${user.q1_1Cleared} / ${user.q1_2Cleared} / ${user.q2Cleared}`}
        />
        <SummaryField label="reported_at" value={user.reportedAt ?? "—"} />
        <SummaryField label="completed_at" value={user.completedAt ?? "—"} />
        <SummaryField
          label="epilogue_viewed_at"
          value={user.epilogueViewedAt ?? "—"}
        />
      </div>
    </SystemPanel>
  );
}

function SummaryField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-text-secondary text-xs">{label}</div>
      <div
        className={`break-all ${
          highlight ? "text-accent" : "text-text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusCorrectionForm({ currentStage }: { currentStage: Stage }) {
  return (
    <SystemPanel>
      <div className="space-y-4">
        <h2 className="font-display text-lg text-text-primary">
          ステータス補正
        </h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="status-correction" />
          <input type="hidden" name="from_stage" value={currentStage} />
          <FormField label="from (現在)">
            <div className="font-mono text-accent">{currentStage}</div>
          </FormField>
          <FormField label="to_stage">
            <select
              name="to_stage"
              required
              defaultValue={currentStage}
              className="bg-bg-primary border border-text-secondary rounded px-3 py-2 text-text-primary font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-full"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="reason_code">
            <TextInput
              name="reason_code"
              required
              placeholder="例: NFC_FAILED, MANUAL_OVERRIDE"
              className="w-full"
            />
          </FormField>
          <FormField label="note (任意)">
            <textarea
              name="note"
              rows={3}
              className="bg-bg-primary border border-text-secondary rounded px-3 py-2 text-text-primary font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-full"
            />
          </FormField>
          <GlowButton type="submit">補正を適用</GlowButton>
        </Form>
      </div>
    </SystemPanel>
  );
}

function MarkReportedForm() {
  return (
    <SystemPanel>
      <div className="space-y-4">
        <h2 className="font-display text-lg text-text-primary">
          報告済み付与
        </h2>
        <p className="text-text-secondary text-sm">
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
            <TextInput
              name="reason_code"
              required
              placeholder="例: REWARD_HANDED"
              className="w-full"
            />
          </FormField>
          <FormField label="note (任意)">
            <textarea
              name="note"
              rows={3}
              className="bg-bg-primary border border-text-secondary rounded px-3 py-2 text-text-primary font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-full"
            />
          </FormField>
          <GlowButton type="submit">報告済みにする</GlowButton>
        </Form>
      </div>
    </SystemPanel>
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
    <div className="space-y-1">
      <label className="block text-text-secondary text-xs font-mono">
        {label}
      </label>
      {children}
    </div>
  );
}

function LogSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SystemPanel>
      <div className="space-y-3">
        <h2 className="font-display text-lg text-text-primary">{title}</h2>
        <div className="overflow-x-auto">{children}</div>
      </div>
    </SystemPanel>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="text-center text-text-secondary font-mono text-sm py-4">
      {text}
    </p>
  );
}
