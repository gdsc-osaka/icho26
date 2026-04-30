import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useActionData } from "react-router";
import { ErrorAlert, HintChat, Icon, PageShell, TextInput } from "~/components";
import { isCorrect } from "~/lib/participant/judge";
import { applyTransition } from "~/lib/participant/mutations";
import { normalize } from "~/lib/participant/normalize";
import { findUserByGroupId } from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  requireParticipant,
} from "~/lib/participant/session";
import { applyQ4Answer } from "~/lib/participant/transitions";
import type { Route } from "./+types/q4";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const raw = String(formData.get("answer") ?? "");
  const normalized = normalize(raw);
  const correct = isCorrect("Q4", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ4Answer(user, correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q4",
      rawInput: raw,
      normalizedInput: normalized,
      correct: correct ? 1 : 0,
      createdAt: now,
    },
    now,
  );

  if (correct) throw redirect("/release");
  return {
    ok: false as const,
    message: "認証失敗。定数を再確認してください。",
  };
}

export default function Q4() {
  const actionData = useActionData<typeof action>();
  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <div className="q4-root relative overflow-hidden">
      {/* Layered backdrop: noise + aurora + grid + sweeping light + particles */}
      <div className="q4-noise pointer-events-none fixed inset-0 z-0" />
      <div className="q4-bloom pointer-events-none fixed inset-0 z-0" />
      <div className="q4-grid pointer-events-none fixed inset-0 z-0" />
      <div className="q4-aurora pointer-events-none fixed inset-0 z-0" />
      <div className="q4-vbeam pointer-events-none fixed inset-0 z-0" />
      <div className="q4-particles pointer-events-none fixed inset-0 z-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="q4-particle"
            style={{
              left: `${(i * 53) % 100}%`,
              animationDelay: `${(i * 0.43) % 6}s`,
              animationDuration: `${7 + (i % 5)}s`,
            }}
          />
        ))}
      </div>

      <PageShell
        sessionId="PRIVILEGE: ROOT"
        rightIcon="sensors"
        widthClass="max-w-2xl"
      >
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center pt-4">
          <PrivilegeBanner />
          <IrisGeometricAvatar />
          <IrisMessage />
          <PuzzleEquation />

          <Form
            method="post"
            className="mb-24 flex w-full max-w-xs flex-col items-center"
          >
            <ConstantInput />
            {errorMessage && (
              <div className="mb-6 w-full">
                <ErrorAlert>{errorMessage}</ErrorAlert>
              </div>
            )}
            <SubmitGhostButton />
          </Form>
        </div>

        <HintChat hint="STAGE 04 は『イリスのラッキーナンバー』が定数です。今日のイベント名や日付に強く結び付いた、二桁の数字を半角で入力してください。" />
      </PageShell>

      <style>{`
        .q4-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='nf'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23nf)' opacity='0.05'/%3E%3C/svg%3E");
        }
        .q4-bloom {
          background:
            radial-gradient(circle at 50% 30%, rgba(0,240,255,0.10) 0%, transparent 55%),
            radial-gradient(circle at 50% 80%, rgba(0,240,255,0.06) 0%, transparent 55%);
        }
        .q4-grid {
          background-image:
            linear-gradient(to right, rgba(0,240,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,240,255,0.05) 1px, transparent 1px);
          background-size: 48px 48px, 48px 48px;
          mask-image: radial-gradient(circle at 50% 50%, black 30%, transparent 80%);
          animation: q4-grid-drift 24s linear infinite;
        }
        .q4-aurora {
          background:
            radial-gradient(60% 40% at 30% 30%, rgba(0,240,255,0.10), transparent 60%),
            radial-gradient(50% 35% at 70% 70%, rgba(125,244,255,0.08), transparent 60%);
          filter: blur(28px);
          animation: q4-aurora-shift 14s ease-in-out infinite;
        }
        .q4-vbeam {
          background: linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.08) 48%, rgba(0,240,255,0.18) 50%, rgba(0,240,255,0.08) 52%, transparent 100%);
          mix-blend-mode: screen;
          animation: q4-vbeam-sweep 7s ease-in-out infinite;
        }
        .q4-particles { overflow: hidden; }
        .q4-particle {
          position: absolute;
          bottom: -10px;
          width: 2px;
          height: 2px;
          border-radius: 9999px;
          background: rgba(125,244,255,0.85);
          box-shadow: 0 0 6px rgba(0,240,255,0.9);
          animation: q4-particle-rise linear infinite;
          opacity: 0;
        }

        @keyframes q4-grid-drift {
          0%   { background-position: 0 0,            0 0; }
          100% { background-position: 48px 48px,  48px 48px; }
        }
        @keyframes q4-aurora-shift {
          0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: 0.9; }
          50%      { transform: translate3d(2%,-1%,0) scale(1.08); opacity: 1; }
        }
        @keyframes q4-vbeam-sweep {
          0%   { transform: translateX(-60%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(60%); opacity: 0; }
        }
        @keyframes q4-particle-rise {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-120vh) translateX(20px); opacity: 0; }
        }

        @keyframes q4-orbit-slow {
          from { transform: rotate(12deg); }
          to   { transform: rotate(372deg); }
        }
        @keyframes q4-orbit-rev {
          from { transform: rotate(-45deg); }
          to   { transform: rotate(-405deg); }
        }
        @keyframes q4-orbit-fwd {
          from { transform: rotate(45deg); }
          to   { transform: rotate(405deg); }
        }
        @keyframes q4-core-pulse {
          0%, 100% { opacity: 1;   transform: scale(1);   box-shadow: 0 0 20px #00f0ff, 0 0 40px #00f0ff; }
          50%      { opacity: 0.85; transform: scale(1.25); box-shadow: 0 0 30px #00f0ff, 0 0 70px rgba(0,240,255,0.7); }
        }
        @keyframes q4-eq-glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(125,244,255,0.30)); }
          50%      { filter: drop-shadow(0 0 22px rgba(125,244,255,0.65)); }
        }
        @keyframes q4-fade-up {
          0%   { opacity: 0; transform: translateY(18px); filter: blur(6px); }
          100% { opacity: 1; transform: none;             filter: blur(0); }
        }
        @keyframes q4-scale-in {
          0%   { opacity: 0; transform: scale(0.7) rotate(-8deg); filter: blur(6px); }
          70%  { opacity: 1; transform: scale(1.06);              filter: blur(0); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes q4-banner-slide {
          0%   { opacity: 0; transform: translateY(-12px) scaleX(0.85); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes q4-iris-radiate {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,240,255,0.35), inset 0 0 18px rgba(0,240,255,0.18); }
          50%      { box-shadow: 0 0 40px 10px rgba(0,240,255,0.10), inset 0 0 28px rgba(0,240,255,0.30); }
        }
        @keyframes q4-iris-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes q4-q-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-8px) scale(1.18); }
        }
        @keyframes q4-glyph-flicker {
          0%, 100%  { opacity: 1; }
          22%, 24%  { opacity: 0.4; }
          23%       { opacity: 0.85; }
          77%, 79%  { opacity: 0.55; }
        }
        @keyframes q4-marquee {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes q4-input-line {
          0%   { transform: scaleX(0); transform-origin: left; }
          50%  { transform: scaleX(1); transform-origin: left; }
          50.01%{ transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
        @keyframes q4-msg-scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        .q4-orbit-slow  { animation: q4-orbit-slow 20s linear infinite; }
        .q4-orbit-rev   { animation: q4-orbit-rev 14s linear infinite; }
        .q4-orbit-fwd   { animation: q4-orbit-fwd 18s linear infinite; }
        .q4-orbit-fast  { animation: q4-orbit-fwd 6s linear infinite; }
        .q4-core-pulse  { animation: q4-core-pulse 2.4s ease-in-out infinite; }
        .q4-eq-glow     { animation: q4-eq-glow 3s ease-in-out infinite; }
        .q4-fade-up     { animation: q4-fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .q4-scale-in    { animation: q4-scale-in 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .q4-banner-slide{ animation: q4-banner-slide 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .q4-iris-radiate{ animation: q4-iris-radiate 3.4s ease-in-out infinite; }
        .q4-q-bounce    { animation: q4-q-bounce 1.8s ease-in-out infinite; }
        .q4-glyph-flicker{ animation: q4-glyph-flicker 5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .q4-orbit-slow, .q4-orbit-rev, .q4-orbit-fwd, .q4-orbit-fast,
          .q4-core-pulse, .q4-eq-glow, .q4-iris-radiate,
          .q4-q-bounce, .q4-glyph-flicker, .q4-grid, .q4-aurora,
          .q4-vbeam, .q4-particle { animation: none; }
        }
      `}</style>
    </div>
  );
}

function PrivilegeBanner() {
  return (
    <div className="q4-banner-slide mb-6 inline-flex items-center gap-3 border border-cyan-500/40 bg-cyan-500/10 px-4 py-1.5 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.15)]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-75" />
        <span className="relative h-2 w-2 rounded-full bg-cyan-400" />
      </span>
      <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-cyan-300 q4-glyph-flicker">
        IRIS // PRIVILEGE_ESCALATED
      </span>
      <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-cyan-500/60">
        STAGE_04
      </span>
    </div>
  );
}

function IrisGeometricAvatar() {
  return (
    <div className="q4-scale-in relative mb-10 flex h-48 w-48 items-center justify-center">
      {/* Halo bloom */}
      <div className="absolute inset-[-12px] rounded-full bg-cyan-400/10 blur-2xl q4-iris-radiate" />
      {/* Outer dashed ring */}
      <div className="q4-orbit-slow absolute inset-0 rounded-full border-2 border-dashed border-cyan-300/30" />
      {/* Mid rings */}
      <div className="q4-orbit-rev absolute inset-3 rounded-full border border-cyan-300/40" />
      <div className="q4-orbit-fwd absolute inset-5 rounded-full border border-cyan-300/20" />
      {/* Triangular markers */}
      <div className="q4-orbit-fast absolute inset-1 pointer-events-none">
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-cyan-400/70" />
        <span className="absolute top-1/2 -left-1 -translate-y-1/2 h-2 w-2 rotate-45 bg-cyan-400/70" />
        <span className="absolute top-1/2 -right-1 -translate-y-1/2 h-2 w-2 rotate-45 bg-cyan-400/70" />
      </div>
      {/* Inner hexagon (wireframe) */}
      <svg
        className="q4-orbit-rev absolute inset-8 h-32 w-32 text-cyan-300/60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <polygon points="50 5, 90 27, 90 73, 50 95, 10 73, 10 27" />
      </svg>
      {/* Inner triangle */}
      <svg
        className="q4-orbit-fwd absolute inset-12 h-24 w-24 text-cyan-200/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <polygon points="50 10, 90 80, 10 80" />
      </svg>
      {/* Vertical scan beam inside avatar */}
      <div className="absolute inset-6 overflow-hidden rounded-full">
        <div
          className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent"
          style={{ animation: "q4-iris-scan 2.6s ease-in-out infinite" }}
        />
      </div>
      {/* Core pulse */}
      <div className="q4-core-pulse relative h-4 w-4 rounded-full bg-cyan-300 mix-blend-screen" />
    </div>
  );
}

function IrisMessage() {
  return (
    <div className="q4-fade-up relative mb-10 w-full overflow-hidden border-l-2 border-cyan-400 bg-surface-container-low/80 p-6 backdrop-blur-md shadow-[inset_0_0_30px_rgba(0,240,255,0.06)]">
      {/* Animated scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 50%, rgba(0,240,255,0.45) 51%, transparent 52%)",
          backgroundSize: "100% 4px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-cyan-400/15 to-transparent"
        style={{ animation: "q4-msg-scan 5s linear infinite" }}
      />
      {/* Corner brackets */}
      <span className="pointer-events-none absolute top-0 left-0 h-3 w-3 border-t border-l border-cyan-400" />
      <span className="pointer-events-none absolute top-0 right-0 h-3 w-3 border-t border-r border-cyan-400/60" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-cyan-400/60" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-cyan-400" />
      {/* Tag */}
      <span className="absolute right-2 top-1 font-mono text-[8px] tracking-widest text-cyan-500/70">
        IRIS_SYS_COMM_v4.7
      </span>

      <p className="relative text-center font-body leading-relaxed text-on-surface opacity-95">
        <span className="q4-fade-up inline-block" style={{ animationDelay: "120ms" }}>
          私を介して
        </span>
        <span
          className="q4-fade-up q4-glyph-flicker mx-1 inline-block font-mono tracking-widest text-cyan-300"
          style={{ animationDelay: "260ms" }}
        >
          ATE
        </span>
        <span className="q4-fade-up inline-block" style={{ animationDelay: "400ms" }}>
          に接続するには、ある
        </span>
        <span
          className="q4-fade-up mx-1 inline-block font-mono text-cyan-300"
          style={{ animationDelay: "540ms" }}
        >
          定数
        </span>
        <span className="q4-fade-up inline-block" style={{ animationDelay: "680ms" }}>
          の認証が必要です。
        </span>
        <br />
        <span
          className="q4-fade-up mt-2 inline-block font-mono text-sm tracking-wider text-cyan-400 q4-glyph-flicker"
          style={{ animationDelay: "900ms" }}
        >
          &gt; その定数を見つけ出してください。
          <span
            className="ml-1 inline-block h-3 w-2 align-middle bg-cyan-400"
            style={{ animation: "q4-glyph-flicker 1s steps(2) infinite" }}
          />
        </span>
      </p>
    </div>
  );
}

function PuzzleEquation() {
  return (
    <div className="q4-fade-up relative mb-12 flex w-full max-w-lg justify-center overflow-hidden py-6">
      {/* Corner brackets */}
      <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t border-l border-cyan-400" />
      <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t border-r border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r border-cyan-400" />
      {/* Side accent lines */}
      <span className="pointer-events-none absolute top-1/2 left-0 h-px w-12 -translate-y-1/2 bg-gradient-to-r from-cyan-400 to-transparent" />
      <span className="pointer-events-none absolute top-1/2 right-0 h-px w-12 -translate-y-1/2 bg-gradient-to-l from-cyan-400 to-transparent" />
      {/* Marquee status strip */}
      <div className="pointer-events-none absolute inset-x-0 -top-1 h-3 overflow-hidden opacity-40">
        <span
          className="block whitespace-nowrap font-mono text-[8px] tracking-widest text-cyan-500"
          style={{ animation: "q4-marquee 14s linear infinite" }}
        >
          ::SOLVE_FOR_CONSTANT::CHANNEL_OPEN::IRIS-ATE::AUTH_PENDING::SOLVE_FOR_CONSTANT::CHANNEL_OPEN::
        </span>
      </div>

      <div className="q4-eq-glow flex items-center gap-4 whitespace-nowrap font-display text-3xl font-semibold tracking-[0.2em] text-primary md:text-4xl">
        <span
          className="q4-fade-up opacity-90"
          style={{ animationDelay: "200ms" }}
        >
          IRIS
        </span>
        <span
          className="q4-fade-up text-cyan-400"
          style={{ animationDelay: "320ms" }}
        >
          −
        </span>
        <span
          className="q4-fade-up opacity-90"
          style={{ animationDelay: "440ms" }}
        >
          ATE
        </span>
        <span
          className="q4-fade-up text-cyan-400"
          style={{ animationDelay: "560ms" }}
        >
          =
        </span>
        <span
          className="q4-fade-up q4-q-bounce inline-block text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,0.7)]"
          style={{ animationDelay: "700ms" }}
        >
          ?
        </span>
      </div>
    </div>
  );
}

function ConstantInput() {
  return (
    <div
      className="q4-fade-up relative mb-8 w-full"
      style={{ animationDelay: "200ms" }}
    >
      <label htmlFor="constant-input" className="sr-only">
        定数を入力
      </label>
      {/* Top label */}
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/70">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          CONSTANT_INPUT
        </span>
        <span className="opacity-60">2_DIGITS</span>
      </div>

      <div className="relative">
        {/* Side decorations */}
        <span className="pointer-events-none absolute -left-3 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border border-cyan-400/60 bg-surface" />
        <span className="pointer-events-none absolute -right-3 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border border-cyan-400/60 bg-surface" />

        <TextInput
          id="constant-input"
          name="answer"
          type="number"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="00"
          required
          className="w-full border-0 border-b-2 border-cyan-400/40 bg-transparent text-center font-display text-4xl tracking-[0.4em] text-cyan-300 placeholder:text-surface-variant focus:border-cyan-400 focus:ring-0 md:text-5xl"
        />

        {/* Animated underline pulse */}
        <span
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
          style={{ animation: "q4-input-line 2.4s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}

function SubmitGhostButton() {
  return (
    <button
      type="submit"
      className="q4-fade-up group relative w-full overflow-hidden border border-cyan-400 bg-surface/50 px-6 py-4 backdrop-blur-sm transition-all duration-300 hover:border-cyan-300 hover:bg-cyan-400/10 hover:shadow-[0_0_25px_rgba(0,240,255,0.4)]"
      style={{ animationDelay: "400ms" }}
    >
      {/* Constant shimmer */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent"
        style={{ animation: "q4-marquee 3.6s linear infinite" }}
      />
      {/* Hover sweep */}
      <div className="pointer-events-none absolute inset-0 -translate-y-full bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent transition-transform duration-1000 ease-linear group-hover:translate-y-full" />
      {/* Corner brackets */}
      <span className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-300" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-300" />
      <span className="relative z-10 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.3em] text-cyan-300 group-hover:text-cyan-100">
        <Icon name="key" className="text-base" />
        AUTHENTICATE
        <Icon
          name="arrow_forward"
          className="text-base transition-transform group-hover:translate-x-1"
        />
      </span>
    </button>
  );
}
