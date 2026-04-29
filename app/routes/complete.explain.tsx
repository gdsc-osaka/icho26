import { Link } from "react-router";
import {
  Icon,
  PageShell,
  StageHeader,
  SystemPanel,
} from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete.explain";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Explain() {
  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="GIMMICK EXPLAINED" eyebrow="POST-MISSION DEBRIEF">
        <p>本イベントで使われたギミックの仕組みを解説します。</p>
      </StageHeader>

      <SystemPanel className="my-8">
        <div className="mb-3 flex items-center gap-2 text-cyan-400">
          <Icon name="psychology" className="text-sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            SYSTEM_NOTE
          </span>
        </div>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          解説テキストは別途追加予定。
        </p>
      </SystemPanel>

      <Link
        to="/complete"
        className="inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-cyan-400"
      >
        <Icon name="arrow_back" className="text-sm" /> BACK TO COMPLETE HUB
      </Link>
    </PageShell>
  );
}
