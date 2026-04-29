import { Link } from "react-router";
import {
  GlowButton,
  Icon,
  PageShell,
  StageHeader,
  SystemPanel,
} from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/release";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Release() {
  return (
    <PageShell sessionId="ID: X-99" rightIcon="celebration">
      <div className="flex flex-1 flex-col items-center gap-8 py-8 text-center">
        <div className="relative">
          <div className="iris-glow flex h-40 w-40 items-center justify-center rounded-full border border-cyan-400 bg-cyan-950/40">
            <div className="absolute inset-0 animate-pulse rounded-full border border-cyan-400/30" />
            <div className="h-24 w-24 rounded-full border-2 border-cyan-400/60 bg-cyan-500/10 shadow-[inset_0_0_30px_rgba(0,240,255,0.3)]" />
          </div>
          <span className="pointer-events-none absolute -top-3 -left-3 h-6 w-6 border-t-2 border-l-2 border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
          <span className="pointer-events-none absolute -bottom-3 -right-3 h-6 w-6 border-b-2 border-r-2 border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
        </div>

        <StageHeader title="ARTE — RELEASED" eyebrow="STATUS = LIBERATED" />

        <SystemPanel className="w-full">
          <p className="font-mono text-base leading-relaxed text-on-surface typewriter">
            29は最強のラッキーナンバーなんですよ! おめでとうございます
          </p>
        </SystemPanel>

        <div className="pt-4">
          <Link to="/complete">
            <GlowButton type="button">CONTINUE</GlowButton>
          </Link>
        </div>
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
    </PageShell>
  );
}
