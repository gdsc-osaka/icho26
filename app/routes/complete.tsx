import { Link } from "react-router";
import {
  Icon,
  PageShell,
  StageHeader,
  SystemPanel,
} from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Complete() {
  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="COMPLETE" eyebrow="MISSION HUB">
        <p>
          エピローグまで含めて物語になっているので是非最後まで読んでみてくださいね。
        </p>
      </StageHeader>

      <div className="mt-8 grid gap-4">
        <ActionCard
          index="01"
          icon="auto_stories"
          label="エピローグを読む"
          subLabel="Read the Epilogue"
          to="/complete/epilogue"
        />
        <ActionCard
          index="02"
          icon="settings"
          label="ギミック解説を見る"
          subLabel="Gimmick Explanation"
          to="/complete/explain"
        />
        <ActionCard
          index="03"
          icon="assignment"
          label="スタッフに報告する"
          subLabel="Report to Staff"
          to="/complete/report"
        />
      </div>
    </PageShell>
  );
}

function ActionCard({
  index,
  icon,
  label,
  subLabel,
  to,
}: {
  index: string;
  icon: string;
  label: string;
  subLabel: string;
  to: string;
}) {
  return (
    <Link to={to} className="group block">
      <SystemPanel className="flex items-center justify-between transition-colors group-hover:border-cyan-400/60">
        <div className="flex items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center border border-cyan-500/30 bg-surface-container transition-colors group-hover:border-cyan-400 group-hover:bg-cyan-950">
            <Icon name={icon} className="text-2xl text-cyan-400" />
          </div>
          <div>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              ACTION // {index}
            </span>
            <span className="block font-body text-base text-on-surface">
              {label}
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
              {subLabel}
            </span>
          </div>
        </div>
        <Icon
          name="arrow_forward_ios"
          className="text-cyan-500/60 transition-transform group-hover:translate-x-1 group-hover:text-cyan-400"
        />
      </SystemPanel>
    </Link>
  );
}
