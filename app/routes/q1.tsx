import { Link, useLoaderData } from "react-router";
import {
  StageHeader,
  SystemPanel,
} from "~/components";
import { requireParticipant, type AppEnv } from "~/lib/participant/session";
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
  return (
    <main className="mx-auto max-w-md px-6 py-12 space-y-6">
      <SystemPanel>
        <StageHeader title="STAGE 01 / DUAL LOCK">
          <p className="font-mono text-text-primary">
            {">"} Iris : 二重ロックを解除してください。
          </p>
          <p className="mt-3 text-text-secondary">
            現在アプリのすべての機能がロックされています。
          </p>
        </StageHeader>
      </SystemPanel>

      <div className="space-y-3">
        <SubCard
          label="DECRYPTION 1-1"
          path="/q1/1"
          cleared={data.q1_1Cleared}
          unlocked={data.unlocked === "Q1_1"}
        />
        <SubCard
          label="DECRYPTION 1-2"
          path="/q1/2"
          cleared={data.q1_2Cleared}
          unlocked={data.unlocked === "Q1_2"}
        />
      </div>
    </main>
  );
}

function SubCard({
  label,
  path,
  cleared,
  unlocked,
}: {
  label: string;
  path: string;
  cleared: boolean;
  unlocked: boolean;
}) {
  if (cleared) {
    return (
      <SystemPanel>
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="text-text-secondary">{label}</span>
          <span className="text-accent">[ CLEARED ]</span>
        </div>
      </SystemPanel>
    );
  }
  if (unlocked) {
    return (
      <Link to={path} className="block">
        <SystemPanel className="hover:border-accent transition-colors">
          <div className="flex items-center justify-between font-mono text-sm">
            <span className="text-accent">{label}</span>
            <span className="text-accent">▶ START</span>
          </div>
        </SystemPanel>
      </Link>
    );
  }
  return (
    <SystemPanel>
      <div className="flex items-center justify-between font-mono text-sm opacity-50">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-secondary">[ LOCKED ]</span>
      </div>
    </SystemPanel>
  );
}
