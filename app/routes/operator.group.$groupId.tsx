import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Form, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import { STAGES, type Stage } from "../../db/schema";
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
    <>
      <TopBar sessionId="OPERATOR" rightIcon="admin_panel_settings" />
      <BackgroundFX />
      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pt-20 pb-12 md:px-6">
        <StageHeader title="GROUP DETAIL" eyebrow={data.user.groupId} />

        {actionData?.ok && (
          <div className="border border-cyan-400 bg-cyan-500/10 px-4 py-2 font-mono text-sm text-cyan-400">
            {actionData.intent === "status-correction"
              ? "ステータスを補正しました"
              : "報告済みとしてマークしました"}
          </div>
        )}
        {actionData && !actionData.ok && (
          <ErrorAlert>{actionData.error}</ErrorAlert>
        )}

        <UserSummary user={data.user} />

        <div className="grid gap-6 md:grid-cols-2">
          <StatusCorrectionForm
            currentStage={data.user.currentStage as Stage}
          />
          {data.user.reportedAt === null ? (
            <MarkReportedForm />
          ) : (
            <SystemPanel>
              <div className="flex items-center gap-2 text-cyan-400">
                <Icon name="task_alt" filled className="text-sm" />
                <h2 className="font-mono text-[10px] uppercase tracking-widest">
                  REPORTED
                </h2>
              </div>
              <p className="mt-2 font-mono text-sm text-on-surface-variant">
                {data.user.reportedAt}
              </p>
            </SystemPanel>
          )}
        </div>

        <LogSection title="試行ログ" icon="history">
          {data.attempts.length === 0 ? (
            <EmptyRow text="no attempts" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-on-surface-variant">
                <tr className="border-b border-cyan-900/50">
                  <th className="py-2 pr-4">created_at</th>
                  <th className="py-2 pr-4">stage</th>
                  <th className="py-2 pr-4">raw</th>
                  <th className="py-2 pr-4">normalized</th>
                  <th className="py-2 pr-4">correct</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-cyan-900/30 hover:bg-cyan-950/10"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-on-surface-variant">
                      {a.createdAt}
                    </td>
                    <td className="py-2 pr-4 font-mono text-cyan-400">
                      {a.stage}
                    </td>
                    <td className="break-all py-2 pr-4 font-mono">
                      {a.rawInput}
                    </td>
                    <td className="break-all py-2 pr-4 font-mono">
                      {a.normalizedInput}
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {a.correct ? (
                        <span className="text-cyan-400">✓</span>
                      ) : (
                        <span className="text-error">✗</span>
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
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-on-surface-variant">
                <tr className="border-b border-cyan-900/50">
                  <th className="py-2 pr-4">created_at</th>
                  <th className="py-2 pr-4">event_type</th>
                  <th className="py-2 pr-4">from</th>
                  <th className="py-2 pr-4">to</th>
                  <th className="py-2 pr-4">detail</th>
                </tr>
              </thead>
              <tbody>
                {data.progress.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-cyan-900/30 hover:bg-cyan-950/10"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-on-surface-variant">
                      {p.createdAt}
                    </td>
                    <td className="py-2 pr-4 font-mono text-cyan-400">
                      {p.eventType}
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {p.fromStage ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono">{p.toStage ?? "—"}</td>
                    <td className="break-all py-2 pr-4 font-mono text-xs">
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
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-on-surface-variant">
                <tr className="border-b border-cyan-900/50">
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
                  <tr
                    key={a.id}
                    className="border-b border-cyan-900/30 hover:bg-cyan-950/10"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-on-surface-variant">
                      {a.createdAt}
                    </td>
                    <td className="py-2 pr-4 font-mono text-cyan-400">
                      {a.actionType}
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {a.fromStage ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono">{a.toStage ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono">{a.reasonCode}</td>
                    <td className="break-all py-2 pr-4 font-mono text-xs">
                      {a.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LogSection>
      </main>
    </>
  );
}

function UserSummary({ user }: { user: UserDetail["user"] }) {
  return (
    <SystemPanel>
      <div className="grid grid-cols-2 gap-4 font-mono text-sm md:grid-cols-4">
        <SummaryField
          label="current_stage"
          value={user.currentStage}
          highlight
        />
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
      <div className="text-[10px] uppercase tracking-widest text-cyan-900">
        {label}
      </div>
      <div
        className={`break-all ${highlight ? "text-cyan-400" : "text-on-surface"}`}
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
        <div className="flex items-center gap-2 text-cyan-400">
          <Icon name="tune" className="text-sm" />
          <h2 className="font-mono text-[10px] uppercase tracking-widest">
            STATUS CORRECTION
          </h2>
        </div>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="status-correction" />
          <input type="hidden" name="from_stage" value={currentStage} />
          <FormField label="from (現在)">
            <div className="font-mono text-cyan-400">{currentStage}</div>
          </FormField>
          <FormField label="to_stage">
            <select
              name="to_stage"
              required
              defaultValue={currentStage}
              className="w-full border border-cyan-900/60 bg-[#05070A]/80 px-3 py-2 font-mono text-on-surface focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
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
            />
          </FormField>
          <FormField label="note (任意)">
            <textarea
              name="note"
              rows={3}
              className="w-full border border-cyan-900/60 bg-[#05070A]/80 px-3 py-2 font-mono text-on-surface focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
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
        <div className="flex items-center gap-2 text-cyan-400">
          <Icon name="assignment_turned_in" className="text-sm" />
          <h2 className="font-mono text-[10px] uppercase tracking-widest">
            MARK REPORTED
          </h2>
        </div>
        <p className="text-sm text-on-surface-variant">
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
            />
          </FormField>
          <FormField label="note (任意)">
            <textarea
              name="note"
              rows={3}
              className="w-full border border-cyan-900/60 bg-[#05070A]/80 px-3 py-2 font-mono text-on-surface focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
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
      <label className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
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
    <SystemPanel>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-cyan-400">
          <Icon name={icon} className="text-sm" />
          <h2 className="font-mono text-[10px] uppercase tracking-widest">
            {title}
          </h2>
        </div>
        <div className="overflow-x-auto">{children}</div>
      </div>
    </SystemPanel>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="py-4 text-center font-mono text-sm text-on-surface-variant">
      {text}
    </p>
  );
}
