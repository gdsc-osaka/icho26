import { Link } from "react-router";
import { Icon, PageShell, StageHeader, SystemPanel } from "~/components";
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
          icon="how_to_vote"
          label="アンケートに回答してブースに投票する"
          subLabel="Vote for Our Booth"
          href="https://ichosai.com/26/search/88/"
          highlight
        />
        <ActionCard
          index="04"
          icon="assignment"
          label="スタッフに報告する"
          subLabel="Report to Staff"
          to="/complete/report"
        />
      </div>
    </PageShell>
  );
}

type ActionCardProps = {
  index: string;
  icon: string;
  label: string;
  subLabel: string;
  highlight?: boolean;
} & ({ to: string; href?: never } | { href: string; to?: never });

function ActionCard({
  index,
  icon,
  label,
  subLabel,
  to,
  href,
  highlight = false,
}: ActionCardProps) {
  const inner = (
    <SystemPanel
      className={`flex items-center justify-between transition-colors ${
        highlight
          ? "border-cyan-400/70 bg-cyan-500/[0.06] shadow-[0_0_20px_rgba(0,240,255,0.12)] group-hover:border-cyan-300"
          : "group-hover:border-cyan-400/60"
      }`}
    >
      <div className="flex items-center gap-5">
        <div
          className={`flex h-12 w-12 items-center justify-center border bg-surface-container transition-colors ${
            highlight
              ? "border-cyan-400/70 bg-cyan-950 group-hover:border-cyan-300"
              : "border-cyan-500/30 group-hover:border-cyan-400 group-hover:bg-cyan-950"
          }`}
        >
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
        name={href ? "open_in_new" : "arrow_forward_ios"}
        className="text-cyan-500/60 transition-transform group-hover:translate-x-1 group-hover:text-cyan-400"
      />
    </SystemPanel>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        {inner}
      </a>
    );
  }

  return (
    <Link to={to!} className="group block">
      {inner}
    </Link>
  );
}
