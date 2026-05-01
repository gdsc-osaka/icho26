import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { useCallback, useMemo, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import * as schema from "../../db/schema";
import { STAGES, type Stage } from "../../db/schema";
import { Icon } from "~/components";
import {
  CopyButton,
  OperatorShell,
  StageBadge,
  StatCard,
} from "~/components/operator";
import { softDeleteUser } from "~/lib/operator/mutations";
import { getStats, listUsers, type DashboardRow } from "~/lib/operator/queries";
import { requireOperatorSession } from "~/lib/operator/session";
import { usePrinterContext } from "~/lib/printer/printer-context";
import type { Route } from "./+types/operator.dashboard";

export function meta() {
  return [{ title: "ダッシュボード | Operator | icho26" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  await requireOperatorSession(request, db);
  const [users, stats, fakeEndRows] = await Promise.all([
    listUsers(db),
    getStats(db),
    db
      .select({
        groupId: schema.progressLogs.groupId,
        reachedAt: sql<string>`MIN(${schema.progressLogs.createdAt})`.as(
          "reached_at",
        ),
      })
      .from(schema.progressLogs)
      .where(eq(schema.progressLogs.toStage, "FAKE_END"))
      .groupBy(schema.progressLogs.groupId),
  ]);
  const fakeEndAt: Record<string, string> = {};
  for (const r of fakeEndRows) fakeEndAt[r.groupId] = r.reachedAt;
  return { users, stats, fakeEndAt };
}

type ActionResult =
  | { ok: true; intent: "soft-delete"; groupId: string }
  | { ok: false; error: string };

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const session = await requireOperatorSession(request, db);

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");

  if (intent === "soft-delete") {
    const groupId = String(formData.get("group_id") ?? "");
    const reasonCode =
      String(formData.get("reason_code") ?? "").trim() || "DASHBOARD_HIDE";
    if (!groupId) return { ok: false, error: "groupId が指定されていません" };

    await softDeleteUser(db, {
      operatorId: session.operatorId,
      groupId,
      reasonCode,
      note: null,
      now: new Date().toISOString(),
    });
    throw redirect("/operator/dashboard");
  }

  return { ok: false, error: "unknown action" };
}

type ReportedFilter = "all" | "reported" | "not_reported";

export default function OperatorDashboard() {
  const { users, stats, fakeEndAt } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { printer } = usePrinterContext();

  const [stageFilter, setStageFilter] = useState<Stage | "ALL">("ALL");
  const [reportedFilter, setReportedFilter] = useState<ReportedFilter>("all");
  const [search, setSearch] = useState("");

  const handlePrintCongestion = useCallback(() => {
    const print = () => printer.printCongestion();
    if (printer.status.isConnected) {
      void print().catch(() => {});
    } else {
      void printer
        .connect()
        .then(print)
        .catch(() => {});
    }
  }, [printer]);

  const printDisabled =
    printer.isConnecting || printer.printState === "printing";

  let printButtonLabel = "混雑状況QRを印刷";
  if (printer.printState === "printing") {
    printButtonLabel = "印刷中...";
  } else if (printer.isConnecting) {
    printButtonLabel = "接続中...";
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (stageFilter !== "ALL" && u.currentStage !== stageFilter) return false;
      if (reportedFilter === "reported" && u.reportedAt === null) return false;
      if (reportedFilter === "not_reported" && u.reportedAt !== null)
        return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = (u.groupName ?? "").toLowerCase();
        const id = u.groupId.toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [users, stageFilter, reportedFilter, search]);

  return (
    <OperatorShell
      title="ダッシュボード"
      eyebrow="DASHBOARD"
      actions={
        <>
          <button
            type="button"
            onClick={handlePrintCongestion}
            disabled={printDisabled}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="print" className="text-sm" />
            {printButtonLabel}
          </button>
          <Link
            to="/operator/issue"
            className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <Icon name="add" className="text-sm" /> ID 発行
          </Link>
        </>
      }
    >
      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon="groups"
          label="登録グループ"
          value={stats.totalGroups}
          hint={`合計 ${stats.totalParticipants} 名`}
        />
        <StatCard
          icon="play_circle"
          label="開始済み"
          value={stats.startedGroups}
          hint={percent(stats.startedGroups, stats.totalGroups)}
          accent="info"
        />
        <StatCard
          icon="hourglass_top"
          label="進行中・未報告"
          value={stats.activeUnreportedGroups}
          hint={`参加者 ${stats.activeUnreportedParticipants} 名`}
          accent="success"
        />
        <StatCard
          icon="assignment_turned_in"
          label="報告済み"
          value={stats.reportedGroups}
          hint={percent(stats.reportedGroups, stats.totalGroups)}
          accent="warning"
        />
      </section>

      {/* Filters */}
      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-700">
              検索（グループ名 / groupId）
            </label>
            <div className="relative mt-1">
              <Icon
                name="search"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-base text-gray-400"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="例: たかし"
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              報告状況
            </label>
            <select
              value={reportedFilter}
              onChange={(e) =>
                setReportedFilter(e.target.value as ReportedFilter)
              }
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="all">すべて</option>
              <option value="reported">報告済みのみ</option>
              <option value="not_reported">未報告のみ</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            STAGE
          </span>
          <FilterChip
            active={stageFilter === "ALL"}
            onClick={() => setStageFilter("ALL")}
          >
            すべて
          </FilterChip>
          {STAGES.map((s) => (
            <FilterChip
              key={s}
              active={stageFilter === s}
              onClick={() => setStageFilter(s)}
            >
              <StageBadge stage={s} />
            </FilterChip>
          ))}
        </div>
      </section>

      {/* Action result */}
      {actionData && !actionData.ok && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      {printer.printState === "error" && printer.errorMessage && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          印刷失敗: {printer.errorMessage}
        </div>
      )}

      {/* Clear time ranking */}
      <ClearTimeRanking users={users} />

      {/* Groups table */}
      <section className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            グループ一覧（{filtered.length} / {users.length}）
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-[10px] font-medium uppercase tracking-widest text-gray-500">
                <th className="px-4 py-2">グループ名</th>
                <th className="px-4 py-2">groupId</th>
                <th className="px-4 py-2">人数</th>
                <th className="px-4 py-2">ステージ</th>
                <th className="px-4 py-2 tabular-nums">試行</th>
                <th className="px-4 py-2">報告</th>
                <th className="px-4 py-2 tabular-nums">クリアタイム</th>
                <th className="px-4 py-2">最終更新</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    該当するグループがありません
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <GroupRow
                  key={u.groupId}
                  user={u}
                  fakeEndAt={fakeEndAt[u.groupId] ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </OperatorShell>
  );
}

type RankedRow = DashboardRow & { elapsedMs: number };

function ClearTimeRanking({ users }: { users: DashboardRow[] }) {
  const ranked: RankedRow[] = useMemo(() => {
    return users
      .filter(
        (u): u is DashboardRow & { startedAt: string; completedAt: string } =>
          u.startedAt !== null && u.completedAt !== null,
      )
      .map((u) => ({
        ...u,
        elapsedMs: Math.max(
          0,
          new Date(u.completedAt).getTime() - new Date(u.startedAt).getTime(),
        ),
      }))
      .sort((a, b) => a.elapsedMs - b.elapsedMs);
  }, [users]);

  const visible = ranked.slice(0, 3);

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="emoji_events" className="text-base text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            クリアタイム ランキング TOP 3
          </h2>
          <span className="text-xs text-gray-500">
            （クリア済み {ranked.length} グループ）
          </span>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-[10px] font-medium uppercase tracking-widest text-gray-500">
              <th className="px-4 py-2 w-12">順位</th>
              <th className="px-4 py-2">グループ名</th>
              <th className="px-4 py-2">groupId</th>
              <th className="px-4 py-2 tabular-nums">クリアタイム</th>
              <th className="px-4 py-2">クリア時刻</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  まだクリア済みのグループがありません
                </td>
              </tr>
            )}
            {visible.map((u, i) => (
              <RankingRow key={u.groupId} rank={i + 1} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankingRow({ rank, user }: { rank: number; user: RankedRow }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-2">
        <RankBadge rank={rank} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">
        {user.groupName ?? "—"}
      </td>
      <td className="px-4 py-2">
        <CopyButton value={user.groupId} label={shortId(user.groupId)} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 font-mono tabular-nums text-gray-900">
        {formatElapsed(user.elapsedMs)}
      </td>
      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500">
        {user.completedAt ? formatTime(user.completedAt) : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <Link
          to={`/operator/group/${user.groupId}`}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          <Icon name="visibility" className="text-sm" />
          詳細
        </Link>
      </td>
    </tr>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : rank === 2
        ? "bg-gray-100 text-gray-800 border-gray-300"
        : rank === 3
          ? "bg-orange-100 text-orange-800 border-orange-300"
          : "bg-white text-gray-600 border-gray-200";
  const icon = rank <= 3 ? "emoji_events" : null;
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${styles}`}
    >
      {icon && <Icon name={icon} className="text-sm" />}#{rank}
    </span>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function GroupRow({
  user,
  fakeEndAt,
}: {
  user: DashboardRow;
  fakeEndAt: string | null;
}) {
  const elapsedMs =
    fakeEndAt && user.startedAt
      ? Math.max(
          0,
          new Date(fakeEndAt).getTime() - new Date(user.startedAt).getTime(),
        )
      : null;

  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">
        {user.groupName ?? "—"}
      </td>
      <td className="px-4 py-2">
        <CopyButton value={user.groupId} label={shortId(user.groupId)} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-700">
        {user.groupSize ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        <StageBadge stage={user.currentStage} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-700">
        {user.attemptCountTotal}
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        {user.reportedAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Icon name="check" className="text-sm" />
            <span className="text-xs">済</span>
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td
        className="whitespace-nowrap px-4 py-2 font-mono tabular-nums text-xs text-gray-700"
        title={
          elapsedMs !== null && fakeEndAt
            ? `偽エンド到達: ${formatDateTime(fakeEndAt)}`
            : undefined
        }
      >
        {elapsedMs !== null ? formatElapsed(elapsedMs) : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500">
        {formatTime(user.updatedAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <Link
            to={`/operator/group/${user.groupId}`}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            <Icon name="visibility" className="text-sm" />
            詳細
          </Link>
          <Form
            method="post"
            onSubmit={(e) => {
              if (
                !confirm(
                  `「${user.groupName ?? user.groupId}」をダッシュボードから非表示にします。よろしいですか?`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="_action" value="soft-delete" />
            <input type="hidden" name="group_id" value={user.groupId} />
            <button
              type="submit"
              title="ダッシュボードから非表示"
              className="inline-flex items-center justify-center rounded-md border border-transparent p-1 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Icon name="delete_outline" className="text-base" />
            </button>
          </Form>
        </div>
      </td>
    </tr>
  );
}

function shortId(groupId: string): string {
  const tail = groupId.replace(/^g_/, "").replace(/-/g, "").slice(-8);
  return `IC-${tail.slice(0, 4).toUpperCase()}-${tail.slice(4).toUpperCase()}`;
}

function percent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 1000) / 10}%`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${HH}:${MM}`;
}

/** 詳細表示向け（年つき・秒つき）。 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  const SS = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${HH}:${MM}:${SS}`;
}
