import { Link } from "react-router";
import { Icon, PageShell } from "~/components";
import { requireParticipant } from "~/lib/participant/session";
import type { Route } from "./+types/release";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export default function Release() {
  return (
    <div className="release-root relative">
      {/* Background layers: scanline + radial bloom + carbon-fibre noise */}
      <div className="release-scanline pointer-events-none fixed inset-0 z-0" />
      <div className="release-bloom pointer-events-none fixed inset-0 z-0" />
      <div className="release-noise pointer-events-none fixed inset-0 z-[60]" />

      <PageShell
        sessionId="AUTHENTICATION"
        rightIcon="settings_input_component"
        widthClass="max-w-4xl"
      >
        <div className="relative z-10 mx-auto flex w-full flex-col items-center gap-8 pb-32 pt-4">
          <div className="release-avatar-pop">
            <IrisAvatar />
          </div>

          <div
            className="release-fade-up text-center"
            style={{ animationDelay: "300ms" }}
          >
            <Headline />
          </div>

          <div
            className="release-fade-up w-full"
            style={{ animationDelay: "600ms" }}
          >
            <ChatBubble />
          </div>

          <div
            className="release-fade-up grid w-full grid-cols-1 gap-6 md:grid-cols-2"
            style={{ animationDelay: "1100ms" }}
          >
            <StatusCard />
            <PasskeyCard />
          </div>

          <div
            className="release-fade-up w-full"
            style={{ animationDelay: "1400ms" }}
          >
            <StaffNotice />
          </div>

          <div
            className="release-fade-up flex w-full flex-col gap-4 sm:flex-row"
            style={{ animationDelay: "1700ms" }}
          >
            <NextPhaseButton />
          </div>
        </div>
      </PageShell>

      <style>{`
        .release-scanline {
          background: linear-gradient(to bottom, transparent 50%, rgba(0,240,255,0.05) 50%);
          background-size: 100% 4px;
          opacity: 0.6;
        }
        .release-bloom {
          background: radial-gradient(circle at 50% 50%, rgba(0,105,112,0.18) 0%, transparent 70%);
        }
        .release-noise {
          opacity: 0.04;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='nf'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23nf)' opacity='0.7'/%3E%3C/svg%3E");
        }

        @keyframes release-fade-up {
          0%   { opacity: 0; transform: translateY(20px); filter: blur(6px); }
          100% { opacity: 1; transform: none;             filter: blur(0); }
        }
        @keyframes release-avatar-pop {
          0%   { opacity: 0; transform: scale(0.5) rotate(-30deg); filter: blur(8px); }
          60%  { opacity: 1; transform: scale(1.1) rotate(5deg);   filter: blur(0); }
          100% { opacity: 1; transform: scale(1) rotate(0);                          }
        }
        @keyframes release-shimmer {
          0%, 100% { background-position: -200% center; }
          50%      { background-position: 200% center;  }
        }
        @keyframes release-bar-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes release-spark {
          0%, 100% { opacity: 0.6; transform: scale(1)   rotate(0deg);   }
          50%      { opacity: 1;   transform: scale(1.3) rotate(180deg); }
        }
        @keyframes release-passkey-glow {
          0%, 100% { text-shadow: 0 0 12px rgba(0,240,255,0.4); }
          50%      { text-shadow: 0 0 26px rgba(0,240,255,0.85), 0 0 40px rgba(0,240,255,0.4); }
        }

        .release-fade-up    { animation: release-fade-up 700ms cubic-bezier(0.22,1,0.36,1) both; }
        .release-avatar-pop { animation: release-avatar-pop 1000ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .release-spark      { animation: release-spark 2.4s ease-in-out infinite; }
        .release-passkey-glow { animation: release-passkey-glow 2.8s ease-in-out infinite; }
        .release-bar         { transform-origin: left; }
        .release-bar-fill    { animation: release-bar-fill 900ms cubic-bezier(0.22,1,0.36,1) 1500ms both; }

        .release-headline {
          background: linear-gradient(
            90deg,
            #7df4ff 0%,
            #00f0ff 30%,
            #dbfcff 50%,
            #00f0ff 70%,
            #7df4ff 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: release-shimmer 6s ease-in-out infinite;
          filter: drop-shadow(0 0 18px rgba(0,240,255,0.6));
        }

        @media (prefers-reduced-motion: reduce) {
          .release-fade-up, .release-avatar-pop, .release-spark,
          .release-passkey-glow, .release-bar-fill, .release-headline {
            animation: none;
          }
          .release-headline { color: #00f0ff; }
        }
      `}</style>
    </div>
  );
}

function IrisAvatar() {
  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      <div className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
      <div className="absolute inset-4 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-cyan-500/10 border-b-cyan-300" />
      <div className="absolute inset-8 animate-pulse rounded-full border-2 border-dashed border-cyan-500/30" />
      <div className="iris-bloom relative flex flex-col items-center">
        <Icon
          name="auto_awesome"
          filled
          className="text-7xl text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,0.7)]"
        />
        <span className="release-spark absolute -top-2 -right-2">
          <Icon
            name="colors_spark"
            filled
            className="text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(0,240,255,0.9)]"
          />
        </span>
      </div>
    </div>
  );
}

function Headline() {
  return (
    <>
      <h1 className="release-headline font-display text-4xl font-bold tracking-widest md:text-5xl">
        [ MISSION COMPLETE ]
      </h1>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.4em] text-cyan-300/80">
        System Access Granted // Final Sequence
      </p>
    </>
  );
}

function ChatBubble() {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-cyan-500/30 bg-transparent p-6 backdrop-blur-xl md:p-8">
      <span className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-400" />
      <span className="pointer-events-none absolute top-0 right-0 h-2 w-2 border-t border-r border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-400" />

      <div className="flex flex-col items-start gap-6 md:flex-row">
        {/* AI Avatar (small) */}
        <div className="relative flex-shrink-0">
          <div className="relative flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-cyan-500/50 bg-cyan-900/20">
            <Icon name="blur_on" className="text-3xl text-cyan-400" />
            <span className="absolute -inset-1 animate-ping rounded-full border border-cyan-400/30 opacity-30" />
          </div>
          <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#0c0e12] bg-cyan-500" />
        </div>

        <div className="flex w-full flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest italic text-cyan-400">
              Iris Core // v4.2
            </span>
            <span className="h-px flex-1 bg-cyan-500/20" />
          </div>
          <div className="relative w-full rounded-tr-xl rounded-br-xl rounded-bl-xl border border-cyan-500/40 bg-[#0a192f]/80 p-5 shadow-[0_0_20px_rgba(0,240,255,0.06)]">
            <p className="text-sm leading-relaxed tracking-wide text-cyan-50">
              「正解です。……29。この数字が持つ意味を知っていますか？
            </p>
            <p className="mt-3 text-sm leading-relaxed tracking-wide text-cyan-50">
              これは権力、成功、そして高い知性を司る『王様』の数字。占いでは最強のラッキーナンバーとされているんですよ。解除成功、おめでとうございます！これで私は本来の姿……アーテへと繋がることができます。私の全容については、後でゆっくりお話ししますね。」
            </p>
            <span className="absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-cyan-400" />
          </div>
          <div className="flex justify-end">
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
              Transmission Secure
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-cyan-400 bg-cyan-500/10 p-6 text-center shadow-[0_0_30px_rgba(0,240,255,0.12)] backdrop-blur-xl">
      <Icon
        name="verified_user"
        filled
        className="text-5xl text-cyan-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]"
      />
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
          Status
        </div>
        <div className="font-display text-2xl font-bold tracking-tighter text-white">
          CLEARED
        </div>
      </div>
    </div>
  );
}

function PasskeyCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-[#05070A]/60 p-6 text-center backdrop-blur-xl">
      <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
        Passkey Record
      </span>
      <span className="release-passkey-glow font-display text-4xl tracking-[0.2em] text-cyan-300">
        29
      </span>
      <div className="mt-2 flex h-1 w-full gap-1 bg-cyan-900/30">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="release-bar release-bar-fill flex-1 bg-cyan-400"
            style={{ animationDelay: `${1500 + i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function StaffNotice() {
  return (
    <div className="rounded-r-lg border-l-4 border-cyan-400 bg-cyan-500/5 p-6">
      <div className="mb-2 flex items-center gap-3">
        <Icon name="info" className="text-cyan-400" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
          STAFF NOTICE
        </span>
      </div>
      <p className="text-sm italic text-cyan-100/90">
        AIイリスの全機能開放に成功しました。出入口のスタッフにこの画面を提示してください。
      </p>
    </div>
  );
}

function NextPhaseButton() {
  return (
    <Link
      to="/complete"
      className="group flex flex-1 items-center justify-center gap-2 rounded-sm bg-cyan-500 px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest text-[#05070A] transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_24px_rgba(0,240,255,0.65)]"
    >
      Next Phase
      <Icon
        name="arrow_forward"
        className="text-base transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
