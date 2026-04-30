import { drizzle } from "drizzle-orm/d1";
import { useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import { STAGES, type Stage } from "../../db/schema";
import {
  BarChart,
  DonutChart,
  OperatorShell,
  StageBadge,
  StatCard,
} from "~/components/operator";
import { getStats, listUsers } from "~/lib/operator/queries";
import { requireOperatorSession } from "~/lib/operator/session";
import type { Route } from "./+types/operator.analytics";

export function meta() {
  return [{ title: "分析 | Operator | icho26" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  await requireOperatorSession(request, db);
  const [stats, users] = await Promise.all([getStats(db), listUsers(db)]);

  // 平均クリア所要時間 = (completedAt - startedAt) の平均（分）
  const completed = users.filter((u) => u.completedAt && u.startedAt);
  const avgClearMinutes =
    completed.length === 0
      ? 0
      : completed.reduce((sum, u) => {
          const ms =
            new Date(u.completedAt!).getTime() -
            new Date(u.startedAt!).getTime();
          return sum + Math.max(0, ms);
        }, 0) /
        completed.length /
        60000;

  // 報告までの平均所要時間 = (reportedAt - startedAt) の平均
  const reported = users.filter((u) => u.reportedAt && u.startedAt);
  const avgReportMinutes =
    reported.length === 0
      ? 0
      : reported.reduce((sum, u) => {
          const ms =
            new Date(u.reportedAt!).getTime() -
            new Date(u.startedAt!).getTime();
          return sum + Math.max(0, ms);
        }, 0) /
        reported.length /
        60000;

  return { stats, avgClearMinutes, avgReportMinutes };
}

const STAGE_COLOR: Record<Stage, string> = {
  START: "bg-gray-300",
  Q1: "bg-blue-500",
  Q2: "bg-indigo-500",
  Q3_KEYWORD: "bg-violet-500",
  Q3_CODE: "bg-violet-600",
  Q4: "bg-pink-500",
  FAKE_END: "bg-amber-500",
  COMPLETE: "bg-emerald-500",
};

const STAGE_HEX: Record<Stage, string> = {
  START: "#d1d5db",
  Q1: "#3b82f6",
  Q2: "#6366f1",
  Q3_KEYWORD: "#8b5cf6",
  Q3_CODE: "#7c3aed",
  Q4: "#ec4899",
  FAKE_END: "#f59e0b",
  COMPLETE: "#10b981",
};

export default function OperatorAnalytics() {
  const { stats, avgClearMinutes, avgReportMinutes } =
    useLoaderData<typeof loader>();

  const stageItems = STAGES.map((s) => ({
    label: s,
    value: stats.stageBreakdown[s],
    color: STAGE_COLOR[s],
  }));

  const stageDonut = STAGES.filter((s) => stats.stageBreakdown[s] > 0).map(
    (s) => ({
      label: s,
      value: stats.stageBreakdown[s],
      color: STAGE_HEX[s],
    }),
  );

  const hourlyMax = Math.max(
    ...stats.hourlyStartedCounts.map((h) => h.count),
    1,
  );

  // ステージ全体プログレス（COMPLETE / startedGroups）
  const completionRate =
    stats.startedGroups === 0
      ? 0
      : (stats.completedGroups / stats.startedGroups) * 100;

  return (
    <OperatorShell title="分析" eyebrow="ANALYTICS">
      {/* 概要 KPI */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon="groups"
          label="総参加グループ"
          value={stats.totalGroups}
          hint={`合計 ${stats.totalParticipants} 名`}
        />
        <StatCard
          icon="play_circle"
          label="開始済み"
          value={stats.startedGroups}
          hint={pct(stats.startedGroups, stats.totalGroups)}
          accent="info"
        />
        <StatCard
          icon="check_circle"
          label="クリア"
          value={stats.completedGroups}
          hint={pct(stats.completedGroups, stats.totalGroups)}
          accent="success"
        />
        <StatCard
          icon="assignment_turned_in"
          label="報告済み"
          value={stats.reportedGroups}
          hint={pct(stats.reportedGroups, stats.totalGroups)}
          accent="warning"
        />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon="quiz"
          label="総試行回数"
          value={stats.totalAttempts}
          hint={`/グループ平均 ${stats.averageAttemptsPerGroup.toFixed(1)} 回`}
        />
        <StatCard
          icon="schedule"
          label="平均クリア所要"
          value={fmtMinutes(avgClearMinutes)}
          hint="開始→COMPLETE"
        />
        <StatCard
          icon="forward_to_inbox"
          label="平均報告所要"
          value={fmtMinutes(avgReportMinutes)}
          hint="開始→報告"
        />
        <StatCard
          icon="bolt"
          label="完走率"
          value={`${completionRate.toFixed(1)}%`}
          hint="クリア/開始済み"
          accent="success"
        />
      </section>

      {/* チャート */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ステージ分布バー */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">
            ステージ別グループ数
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            各ステージに何グループ滞留しているか
          </p>
          <BarChart items={stageItems} />
        </div>

        {/* ステージ分布ドーナツ */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">分布</h2>
          <p className="mb-4 text-xs text-gray-500">滞留ステージの内訳</p>
          {stageDonut.length === 0 ? (
            <p className="text-sm text-gray-500">データなし</p>
          ) : (
            <DonutChart
              slices={stageDonut}
              centerLabel="グループ"
              centerValue={stats.totalGroups}
            />
          )}
        </div>
      </section>

      {/* 時間別開始 */}
      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          開始時刻分布（時間帯別）
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          各時刻に何グループが「START」を抜けたか
        </p>
        <div className="flex h-32 items-end gap-1">
          {stats.hourlyStartedCounts.map((h) => {
            const heightPct = (h.count / hourlyMax) * 100;
            return (
              <div key={h.hour} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t-sm bg-gray-900/80 transition-[height] duration-500"
                  style={{ height: `${heightPct}%` }}
                  title={`${h.hour}時: ${h.count} グループ`}
                />
                <span className="mt-1 font-mono text-[9px] text-gray-500">
                  {h.hour}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ステージ凡例 */}
      <section className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          ステージ凡例
        </span>
        {STAGES.map((s) => (
          <StageBadge key={s} stage={s} />
        ))}
      </section>
    </OperatorShell>
  );
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 1000) / 10}%`;
}

function fmtMinutes(min: number): string {
  if (min === 0) return "—";
  if (min < 60) return `${min.toFixed(1)} 分`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h}h ${m}m`;
}
