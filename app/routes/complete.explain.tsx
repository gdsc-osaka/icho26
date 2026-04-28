import { Link } from "react-router";
import { StageHeader, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete.explain";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Explain() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="GIMMICK EXPLAINED">
          <p>本イベントで使われたギミックの仕組みを解説します。</p>
        </StageHeader>
      </SystemPanel>

      <SystemPanel>
        <p className="text-sm leading-relaxed text-text-secondary">
          解説テキストは別途追加予定。
        </p>
      </SystemPanel>

      <Link
        to="/complete"
        className="block text-center font-mono text-xs text-accent underline"
      >
        BACK TO COMPLETE HUB
      </Link>
    </main>
  );
}
