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

        /* === Iris avatar rich animations === */
        @keyframes release-iris-halo {
          0%, 100% { opacity: 0.55; transform: scale(1);    }
          50%      { opacity: 0.95; transform: scale(1.08); }
        }
        .release-iris-halo {
          background: radial-gradient(circle at 50% 50%, rgba(0,240,255,0.35) 0%, rgba(0,240,255,0.10) 40%, transparent 70%);
          filter: blur(18px);
          animation: release-iris-halo 3.6s ease-in-out infinite;
        }

        @keyframes release-iris-pulse {
          0%   { transform: scale(1);    opacity: 0.7; }
          80%  { transform: scale(1.45); opacity: 0;   }
          100% { transform: scale(1.45); opacity: 0;   }
        }
        .release-iris-pulse {
          animation: release-iris-pulse 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-origin: 50% 50%;
        }

        @keyframes release-iris-conic-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .release-iris-conic {
          background: conic-gradient(from 0deg,
            transparent 0deg,
            rgba(0,240,255,0.0) 240deg,
            rgba(0,240,255,0.55) 320deg,
            rgba(125,244,255,0.9) 350deg,
            transparent 360deg);
          mask: radial-gradient(circle, transparent 60%, black 62%, black 70%, transparent 72%);
          -webkit-mask: radial-gradient(circle, transparent 60%, black 62%, black 70%, transparent 72%);
          animation: release-iris-conic-spin 4s linear infinite;
        }

        @keyframes release-iris-ticks-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .release-iris-ticks-slow {
          animation: release-iris-ticks-spin 24s linear infinite;
        }

        @keyframes release-iris-radiate {
          0%, 100% { box-shadow: inset 0 0 30px rgba(0,240,255,0.25), 0 0 0 0 rgba(0,240,255,0.0); }
          50%      { box-shadow: inset 0 0 50px rgba(0,240,255,0.55), 0 0 30px rgba(0,240,255,0.30); }
        }
        .release-iris-radiate { animation: release-iris-radiate 3s ease-in-out infinite; }

        @keyframes release-iris-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(100%);  opacity: 0; }
        }
        .release-iris-scan { animation: release-iris-scan 2.4s ease-in-out infinite; }

        @keyframes release-iris-bracket-flicker {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(0,240,255,0.7)); }
          50%      { opacity: 0.5; filter: drop-shadow(0 0 0 transparent); }
        }
        .release-iris-bracket { animation: release-iris-bracket-flicker 2.6s ease-in-out infinite; }

        @keyframes release-iris-orbit-a {
          0%   { transform: translate(-50%, -50%) rotate(0deg)   translateX(118px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(118px) rotate(-360deg); }
        }
        @keyframes release-iris-orbit-b {
          0%   { transform: translate(-50%, -50%) rotate(0deg)    translateX(86px)  rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(-360deg) translateX(86px)  rotate(360deg); }
        }
        @keyframes release-iris-orbit-c {
          0%   { transform: translate(-50%, -50%) rotate(180deg) translateX(102px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(540deg) translateX(102px) rotate(-360deg); }
        }
        .release-iris-orbit-a { animation: release-iris-orbit-a 6s linear infinite; }
        .release-iris-orbit-b { animation: release-iris-orbit-b 4.2s linear infinite; }
        .release-iris-orbit-c { animation: release-iris-orbit-c 8s linear infinite; }

        @keyframes release-iris-spark {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .release-iris-spark {
          background:
            conic-gradient(from 0deg,
              transparent 0deg,
              rgba(125,244,255,0.4) 30deg,
              transparent 60deg,
              transparent 180deg,
              rgba(125,244,255,0.4) 210deg,
              transparent 240deg);
          filter: blur(4px);
          animation: release-iris-spark 5s linear infinite;
        }

        @keyframes release-iris-icon-float {
          0%, 100% { transform: translateY(0)   scale(1);    filter: drop-shadow(0 0 28px rgba(0,240,255,0.95)); }
          50%      { transform: translateY(-3px) scale(1.06); filter: drop-shadow(0 0 42px rgba(0,240,255,1)); }
        }
        .release-iris-icon { animation: release-iris-icon-float 3.6s ease-in-out infinite; }

        @keyframes release-iris-label-pop {
          0%   { opacity: 0; transform: translate(-50%, -8px) scale(0.85); }
          100% { opacity: 1; transform: translate(-50%, 0)    scale(1);    }
        }
        .release-iris-label {
          animation: release-iris-label-pop 700ms 1100ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
            release-passkey-glow 2.8s ease-in-out infinite 1800ms;
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
          .release-passkey-glow, .release-bar-fill, .release-headline,
          .release-iris-halo, .release-iris-pulse, .release-iris-conic,
          .release-iris-ticks-slow, .release-iris-radiate, .release-iris-scan,
          .release-iris-bracket, .release-iris-orbit-a, .release-iris-orbit-b,
          .release-iris-orbit-c, .release-iris-spark, .release-iris-icon,
          .release-iris-label {
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
    <div className="release-iris relative flex h-64 w-64 items-center justify-center">
      {/* Aurora bloom halo (breathing) */}
      <div className="release-iris-halo absolute inset-[-28px] rounded-full" />

      {/* Expanding pulse rings */}
      <div className="release-iris-pulse absolute inset-0 rounded-full border border-cyan-400/40" />
      <div
        className="release-iris-pulse absolute inset-0 rounded-full border border-cyan-400/30"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="release-iris-pulse absolute inset-0 rounded-full border border-cyan-400/20"
        style={{ animationDelay: "2s" }}
      />

      {/* Conic gradient sweep ring */}
      <div className="release-iris-conic absolute inset-0 rounded-full" />

      {/* Outer rotating ring with arc highlight */}
      <div className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border-2 border-cyan-500/20 border-t-cyan-300 shadow-[0_0_30px_rgba(0,240,255,0.25)]" />

      {/* Outer marker ticks (rotates slow) */}
      <div className="release-iris-ticks-slow absolute inset-1 pointer-events-none">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 h-2 w-px bg-cyan-300/70"
            style={{
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-126px)`,
              boxShadow: "0 0 4px rgba(0,240,255,0.7)",
            }}
          />
        ))}
      </div>

      {/* Mid dashed ring rotating reverse */}
      <div className="absolute inset-4 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-300/50" />

      {/* Inner solid ring with inset glow */}
      <div className="release-iris-radiate absolute inset-8 rounded-full border-2 border-cyan-400/60 shadow-[inset_0_0_30px_rgba(0,240,255,0.35)]" />

      {/* Internal vertical scan beam */}
      <div className="absolute inset-10 overflow-hidden rounded-full">
        <div className="release-iris-scan absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-cyan-400/45 to-transparent" />
      </div>

      {/* Crosshair targeting */}
      <span className="pointer-events-none absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-cyan-300/60" />
      <span className="pointer-events-none absolute left-1/2 bottom-0 h-3 w-px -translate-x-1/2 bg-cyan-300/60" />
      <span className="pointer-events-none absolute top-1/2 left-0 h-px w-3 -translate-y-1/2 bg-cyan-300/60" />
      <span className="pointer-events-none absolute top-1/2 right-0 h-px w-3 -translate-y-1/2 bg-cyan-300/60" />

      {/* Privilege corner brackets */}
      <span className="release-iris-bracket pointer-events-none absolute -top-2 -left-2 h-4 w-4 border-t-2 border-l-2 border-cyan-300" />
      <span className="release-iris-bracket pointer-events-none absolute -top-2 -right-2 h-4 w-4 border-t-2 border-r-2 border-cyan-300" />
      <span className="release-iris-bracket pointer-events-none absolute -bottom-2 -left-2 h-4 w-4 border-b-2 border-l-2 border-cyan-300" />
      <span className="release-iris-bracket pointer-events-none absolute -bottom-2 -right-2 h-4 w-4 border-b-2 border-r-2 border-cyan-300" />

      {/* Orbiting particles */}
      <span className="release-iris-orbit-a absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.95)]" />
      <span className="release-iris-orbit-b absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-cyan-100" />
      <span className="release-iris-orbit-c absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-300/80 shadow-[0_0_8px_rgba(0,240,255,0.8)]" />

      {/* Core icon with rotating sparkle layer */}
      <div className="iris-bloom release-iris-core relative flex items-center justify-center">
        <div className="release-iris-spark absolute inset-[-10px] rounded-full" />
        <Icon
          name="auto_awesome"
          filled
          className="release-iris-icon text-8xl text-cyan-200 drop-shadow-[0_0_28px_rgba(0,240,255,0.95)]"
        />
      </div>

      {/* Privilege label arc (top) */}
      <span className="release-iris-label pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.4em] text-cyan-300 backdrop-blur-md">
        ROOT_PRIVILEGE // GRANTED
      </span>
    </div>
  );
}

function Headline() {
  return (
    <>
      <h1 className="release-headline font-display text-4xl font-bold tracking-widest md:text-5xl">
        MISSION COMPLETE
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
