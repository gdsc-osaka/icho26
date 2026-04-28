import { Link } from "react-router";
import { StageHeader, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/complete";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Complete() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="COMPLETE">
          <p>
            エピローグまで含めて物語になっているので是非最後まで読んでみてくださいね。
          </p>
        </StageHeader>
      </SystemPanel>

      <div className="space-y-3">
        <CompleteLink to="/complete/epilogue" label="エピローグを読む" />
        <CompleteLink to="/complete/explain" label="ギミック解説を見る" />
        <CompleteLink to="/complete/report" label="スタッフに報告する" />
      </div>
    </main>
  );
}

function CompleteLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="block">
      <SystemPanel className="hover:border-accent transition-colors">
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="text-accent">{label}</span>
          <span className="text-accent">▶</span>
        </div>
      </SystemPanel>
    </Link>
  );
}
