import { Link } from "react-router";
import { GlowButton, StageHeader, SystemPanel } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/release";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Release() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel className="border-accent">
        <StageHeader title="ARTE — RELEASED">
          <p className="font-mono text-text-primary leading-relaxed typewriter">
            29は最強のラッキーナンバーなんですよ! おめでとうございます
          </p>
        </StageHeader>
      </SystemPanel>

      <p className="text-center font-mono text-xs text-text-secondary">
        □ ARTE :: STATUS = LIBERATED
      </p>

      <div className="flex justify-center pt-4">
        <Link to="/complete">
          <GlowButton type="button">CONTINUE</GlowButton>
        </Link>
      </div>

      <style>{`
        @keyframes typewriter-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
        .typewriter {
          animation: typewriter-fade 1.6s ease-out both;
        }
      `}</style>
    </main>
  );
}
