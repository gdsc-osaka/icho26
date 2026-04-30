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
    <div className="q4-root relative">
      {/* SVG noise + radial cyan bloom backdrop */}
      <div className="q4-noise pointer-events-none fixed inset-0 z-0" />
      <div className="q4-bloom pointer-events-none fixed inset-0 z-0" />

      <PageShell
        sessionId="ID: X-99"
        rightIcon="sensors"
        widthClass="max-w-2xl"
      >
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center pt-4">
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
            radial-gradient(circle at 50% 50%, rgba(0,240,255,0.06) 0%, transparent 60%);
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
          0%, 100% { opacity: 1;   transform: scale(1);   }
          50%      { opacity: 0.7; transform: scale(1.15);}
        }
        @keyframes q4-eq-glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(125,244,255,0.30)); }
          50%      { filter: drop-shadow(0 0 18px rgba(125,244,255,0.55)); }
        }
        .q4-orbit-slow { animation: q4-orbit-slow 20s linear infinite; }
        .q4-orbit-rev  { animation: q4-orbit-rev 14s linear infinite; }
        .q4-orbit-fwd  { animation: q4-orbit-fwd 18s linear infinite; }
        .q4-core-pulse { animation: q4-core-pulse 2.4s ease-in-out infinite; }
        .q4-eq-glow    { animation: q4-eq-glow 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .q4-orbit-slow, .q4-orbit-rev, .q4-orbit-fwd,
          .q4-core-pulse, .q4-eq-glow { animation: none; }
        }
      `}</style>
    </div>
  );
}

function IrisGeometricAvatar() {
  return (
    <div className="relative mb-12 flex h-40 w-40 items-center justify-center">
      {/* Outer dashed ring */}
      <div className="q4-orbit-slow absolute inset-0 rounded-full border-2 border-dashed border-cyan-300/20" />
      {/* Mid rings */}
      <div className="q4-orbit-rev absolute inset-4 rounded-full border border-cyan-300/40" />
      <div className="q4-orbit-fwd absolute inset-4 rounded-full border border-cyan-300/20" />
      {/* Inner hexagon (wireframe) */}
      <svg
        className="absolute inset-8 h-24 w-24 text-cyan-300/60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <polygon points="50 5, 90 27, 90 73, 50 95, 10 73, 10 27" />
      </svg>
      {/* Core pulse */}
      <div className="q4-core-pulse h-3 w-3 rounded-full bg-cyan-400 mix-blend-screen shadow-[0_0_20px_#00f0ff,0_0_40px_#00f0ff]" />
    </div>
  );
}

function IrisMessage() {
  return (
    <div className="relative mb-12 w-full border-l-2 border-cyan-400 bg-surface-container-low/80 p-6 backdrop-blur-md shadow-[inset_0_0_30px_rgba(0,240,255,0.04)]">
      <span className="absolute top-0 left-0 h-px w-8 bg-cyan-400" />
      <span className="absolute bottom-0 right-0 h-px w-8 bg-cyan-400/50" />
      <p className="text-center font-body leading-relaxed text-on-surface opacity-90">
        To connect to ATE through me, a specific constant must be authenticated.{" "}
        <span className="font-mono text-sm tracking-wider text-cyan-400">
          Search for the constant.
        </span>
      </p>
    </div>
  );
}

function PuzzleEquation() {
  return (
    <div className="relative mb-12 flex w-full max-w-lg justify-center py-6">
      <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t border-l border-outline-variant" />
      <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t border-r border-outline-variant" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l border-outline-variant" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r border-outline-variant" />
      <div className="q4-eq-glow flex items-center gap-4 whitespace-nowrap font-display text-2xl font-semibold tracking-[0.2em] text-primary md:text-3xl">
        <span className="opacity-80">IRIS</span>
        <span className="text-on-surface-variant">-</span>
        <span className="opacity-80">ATE</span>
        <span className="text-on-surface-variant">=</span>
        <span className="animate-pulse text-cyan-400">?</span>
      </div>
    </div>
  );
}

function ConstantInput() {
  return (
    <div className="relative mb-8 w-full">
      <label htmlFor="constant-input" className="sr-only">
        Enter Constant
      </label>
      <TextInput
        id="constant-input"
        name="answer"
        type="number"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        placeholder="00"
        required
        className="w-full border-0 border-b-2 border-cyan-400/40 bg-transparent text-center font-display text-4xl tracking-[0.4em] text-cyan-400 placeholder:text-surface-variant focus:border-cyan-400 focus:ring-0 md:text-5xl"
      />
    </div>
  );
}

function SubmitGhostButton() {
  return (
    <button
      type="submit"
      className="group relative w-full overflow-hidden border border-cyan-400 bg-surface/50 px-6 py-4 backdrop-blur-sm transition-all duration-300 hover:border-cyan-300 hover:bg-cyan-400/10 hover:shadow-[0_0_15px_rgba(0,240,255,0.25)]"
    >
      <div className="pointer-events-none absolute inset-0 -translate-y-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent transition-transform duration-1000 ease-linear group-hover:translate-y-full" />
      <span className="relative z-10 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.3em] text-cyan-400 group-hover:text-cyan-200">
        <Icon name="key" className="text-base" />
        SUBMIT
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 bg-cyan-400 opacity-50" />
    </button>
  );
}
