import { Link, useLoaderData } from "react-router";
import { HintChat, Icon, PageShell, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import { unlockedSub } from "~/lib/participant/transitions";
import type { Route } from "./+types/q1";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  return {
    q1_1Cleared: user.q1_1Cleared === 1,
    q1_2Cleared: user.q1_2Cleared === 1,
    unlocked: unlockedSub(user),
  };
}

export default function Q1Hub() {
  const data = useLoaderData<typeof loader>();
  const cleared = Number(data.q1_1Cleared) + Number(data.q1_2Cleared);

  return (
    <PageShell sessionId="ID: X-99" rightIcon="sensors">
      <Hologram />

      <div className="mb-8 text-center">
        <div className="mb-3 inline-block border border-cyan-500/40 bg-cyan-950/30 px-3 py-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
            SYSTEM MESSAGE
          </p>
        </div>
        <p className="font-mono leading-relaxed text-primary">
          全てのアプリ機能は現在ロックされています。
          <br />
          <span className="font-bold text-cyan-400">
            二重ロックを解除してください。
          </span>
        </p>
      </div>

      <ProgressBar cleared={cleared} />

      <div className="mt-6 space-y-4">
        <SubCard
          eyebrow="SUBTASK Q1-1"
          title="方程式パズル"
          icon="grid_view"
          path="/q1/1"
          cleared={data.q1_1Cleared}
          unlocked={data.unlocked === "Q1_1"}
        />
        <SubCard
          eyebrow="SUBTASK Q1-2"
          title="周辺スキャン"
          icon="schema"
          path="/q1/2"
          cleared={data.q1_2Cleared}
          unlocked={data.unlocked === "Q1_2"}
        />
      </div>

      <div className="mt-8 flex items-start gap-3 border-l-2 border-cyan-500/50 bg-cyan-950/10 p-4">
        <Icon name="info" className="mt-0.5 text-sm text-cyan-500" />
        <p className="font-mono text-xs leading-relaxed text-cyan-300/70">
          <span className="font-bold text-cyan-400">Note:</span>{" "}
          進むには両方のサブタスクをクリアする必要があります。
        </p>
      </div>

      <HintChat hint="STAGE 01 は二つのサブ設問の二重ロックです。先に解放されている方からひとつずつ取り組んでください。両方クリアできれば ステージクリアです。" />
    </PageShell>
  );
}

function Hologram() {
  return (
    <div className="mx-auto mb-8 flex h-40 w-40 items-center justify-center">
      <div className="relative h-full w-full">
        <div className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border border-cyan-500/20" />
        <div className="absolute inset-3 animate-[spin_8s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-400/40" />
        <div className="iris-glow absolute inset-10 flex rotate-45 items-center justify-center border-2 border-cyan-400">
          <div className="absolute inset-2 -rotate-45 border border-cyan-400" />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ cleared }: { cleared: number }) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          PROGRESS_STATUS
        </span>
        <span className="font-mono text-xs text-cyan-400">
          {cleared}/2 解除済み
        </span>
      </div>
      <div className="flex h-1.5 w-full gap-1 bg-surface-container-highest">
        <div
          className={`h-full ${cleared >= 1 ? "bg-cyan-400 shadow-[0_0_10px_#00f0ff]" : "bg-cyan-950/40"} flex-1`}
        />
        <div
          className={`h-full ${cleared >= 2 ? "bg-cyan-400 shadow-[0_0_10px_#00f0ff]" : "bg-cyan-950/40"} flex-1`}
        />
      </div>
    </div>
  );
}

type SubCardProps = {
  eyebrow: string;
  title: string;
  icon: string;
  path: string;
  cleared: boolean;
  unlocked: boolean;
};

function SubCard({
  eyebrow,
  title,
  icon,
  path,
  cleared,
  unlocked,
}: SubCardProps) {
  const inner = (
    <SystemPanel className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center border border-cyan-800 bg-cyan-950/20">
          <Icon
            name={icon}
            className={cleared ? "text-cyan-400" : "text-cyan-900/60"}
          />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
            {eyebrow}
          </p>
          <h3 className="font-mono text-lg text-on-surface">{title}</h3>
        </div>
      </div>
      <div className="flex flex-col items-end">
        {cleared ? (
          <>
            <Icon
              name="check_circle"
              filled
              className="mb-1 text-2xl text-cyan-400"
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              CLEARED
            </span>
          </>
        ) : unlocked ? (
          <>
            <Icon name="lock_open" className="mb-1 text-2xl text-cyan-400" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              ▶ START
            </span>
          </>
        ) : (
          <>
            <Icon name="lock" filled className="mb-1 text-2xl text-error" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-error">
              LOCKED
            </span>
          </>
        )}
      </div>
    </SystemPanel>
  );

  if (cleared || !unlocked) return <div className="opacity-80">{inner}</div>;
  return (
    <Link to={path} className="block transition-transform active:scale-[0.98]">
      {inner}
    </Link>
  );
}
