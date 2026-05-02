import { drizzle } from "drizzle-orm/d1";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Form, redirect, useActionData, useLoaderData } from "react-router";
import { ErrorAlert, HintChat, Icon, PageShell } from "~/components";
import { isCorrect } from "~/lib/participant/judge";
import { applyTransition } from "~/lib/participant/mutations";
import { normalize } from "~/lib/participant/normalize";
import { findUserByGroupId } from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  requireParticipant,
} from "~/lib/participant/session";
import { applyQ3Code, applyQ3Keyword } from "~/lib/participant/transitions";
import type { Route } from "./+types/q3";

const CODE_LENGTH = 4;

type ActionResult =
  | { ok: false; phase: "keyword" | "code"; messageKey: string }
  | { ok: true };

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  return {
    keywordCleared: user.currentStage === "Q3_CODE",
  };
}

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const rawKeyword = String(formData.get("keyword") ?? "");
  const codeChars = Array.from({ length: CODE_LENGTH }, (_, i) =>
    String(formData.get(`code_${i}`) ?? "").trim(),
  );
  const rawCode = codeChars.join("");

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();

  // PHASE_01 ステージ: keyword 画面のみ表示中
  if (user.currentStage === "Q3_KEYWORD") {
    const normalizedKeyword = normalize(rawKeyword);
    const kwCorrect = isCorrect("Q3_KEYWORD", normalizedKeyword);
    const t = applyQ3Keyword(user, kwCorrect, now);
    await applyTransition(
      db,
      t.user,
      t.events,
      {
        id: crypto.randomUUID(),
        groupId,
        stage: "Q3_KEYWORD",
        rawInput: rawKeyword,
        normalizedInput: normalizedKeyword,
        correct: kwCorrect ? 1 : 0,
        createdAt: now,
      },
      now,
    );
    if (!kwCorrect) {
      return {
        ok: false,
        phase: "keyword",
        messageKey: "errors.q3KeywordFailed",
      };
    }
    // 成功 → loader 再走させ Privilege 画面が View Transition でフェードイン
    throw redirect("/q3");
  }

  // PHASE_02 ステージ: code 画面のみ表示中
  if (user.currentStage === "Q3_CODE") {
    const normalizedCode = normalize(rawCode);
    const codeCorrect = isCorrect("Q3_CODE", normalizedCode);
    const t = applyQ3Code(user, codeCorrect, now);
    await applyTransition(
      db,
      t.user,
      t.events,
      {
        id: crypto.randomUUID(),
        groupId,
        stage: "Q3_CODE",
        rawInput: rawCode,
        normalizedInput: normalizedCode,
        correct: codeCorrect ? 1 : 0,
        createdAt: now,
      },
      now,
    );
    if (!codeCorrect) {
      return {
        ok: false,
        phase: "code",
        messageKey: "errors.q3CodeFailed",
      };
    }
    if (t.user.currentStage === "Q4") throw redirect("/q4");
  }

  return {
    ok: false,
    phase: "keyword",
    messageKey: "errors.unexpectedState",
  };
}

export default function Q3() {
  const { t } = useTranslation();
  const { keywordCleared } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errorMessage =
    actionData?.ok === false ? t(actionData.messageKey) : null;

  return (
    <>
      <style>{`
        /* === Stage 1 (IndoorSearch) === */
        @keyframes q3-stage-enter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        .q3-stage-enter {
          animation: q3-stage-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        /* === Stage 2 (Privilege) — staggered enter === */
        @keyframes q3-fade-up {
          0%   { opacity: 0; transform: translateY(24px); filter: blur(6px); }
          100% { opacity: 1; transform: none;             filter: blur(0); }
        }
        @keyframes q3-scale-in {
          0%   { opacity: 0; transform: scale(0.4) rotate(-15deg); filter: blur(8px); }
          60%  { opacity: 1; transform: scale(1.08) rotate(2deg);  filter: blur(0); }
          100% { opacity: 1; transform: scale(1) rotate(0);                            }
        }
        @keyframes q3-cell-pop {
          0%   { opacity: 0; transform: translateY(-12px) scale(0.6); filter: blur(4px); }
          70%  { opacity: 1; transform: translateY(2px) scale(1.04);  filter: blur(0);   }
          100% { opacity: 1; transform: none scale(1);                                    }
        }
        @keyframes q3-slide-down {
          0%   { opacity: 0; transform: translateY(-32px) scaleX(0.85); }
          100% { opacity: 1; transform: none scaleX(1);                  }
        }

        /* === Continuous decorative === */
        @keyframes q3-bg-grid-drift {
          0%   { background-position: 0 0,            0 0; }
          100% { background-position: 60px 60px,  60px 60px; }
        }
        @keyframes q3-bg-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1);   }
          50%      { opacity: 0.55; transform: scale(1.1); }
        }
        @keyframes q3-bg-sweep {
          0%   { transform: translateY(-110vh); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes q3-cell-glow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(0,240,255,0.35), inset 0 0 8px rgba(0,240,255,0.10); }
          50%      { box-shadow: 0 0 0 1px rgba(0,240,255,0.75), inset 0 0 22px rgba(0,240,255,0.30); }
        }
        @keyframes q3-orbit {
          0%   { transform: translate(-50%, -50%) rotate(0deg)   translateX(60px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(60px) rotate(-360deg); }
        }
        @keyframes q3-orbit-rev {
          0%   { transform: translate(-50%, -50%) rotate(0deg)    translateX(46px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(-360deg) translateX(46px) rotate(360deg); }
        }
        @keyframes q3-flicker {
          0%, 100%  { opacity: 1; }
          17%, 19%  { opacity: 0.4; }
          18%       { opacity: 0.8; }
          85%, 87%  { opacity: 0.6; }
        }
        @keyframes q3-marquee {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes q3-bar-fill {
          0%   { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }

        /* === Utility classes === */
        .q3-stage-enter   { animation: q3-stage-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .q3-fade-up       { animation: q3-fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .q3-scale-in      { animation: q3-scale-in 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .q3-cell-pop      { animation: q3-cell-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .q3-slide-down    { animation: q3-slide-down 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .q3-flicker       { animation: q3-flicker 5s ease-in-out infinite; }
        .q3-cell-glow     { animation: q3-cell-glow 2.6s ease-in-out infinite; }

        /* === Layered background for Privilege screen === */
        .q3-bg-root::before,
        .q3-bg-root::after {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .q3-bg-root::before {
          background-image:
            linear-gradient(to right, rgba(0, 240, 255, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 240, 255, 0.06) 1px, transparent 1px);
          background-size: 60px 60px, 60px 60px;
          animation: q3-bg-grid-drift 18s linear infinite;
          mask-image: radial-gradient(circle at 50% 50%, black 30%, transparent 80%);
        }
        .q3-bg-root::after {
          background:
            radial-gradient(circle at 30% 20%, rgba(0, 240, 255, 0.10), transparent 50%),
            radial-gradient(circle at 70% 80%, rgba(0, 240, 255, 0.08), transparent 55%);
          animation: q3-bg-pulse 6s ease-in-out infinite;
        }
        .q3-bg-noise {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.06;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
        }
        .q3-bg-sweep {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          height: 30vh;
          background: linear-gradient(to bottom,
            transparent,
            rgba(0, 240, 255, 0.08) 40%,
            rgba(0, 240, 255, 0.18) 50%,
            rgba(0, 240, 255, 0.08) 60%,
            transparent);
          animation: q3-bg-sweep 4.5s cubic-bezier(0.5, 0, 0.5, 1) 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .q3-stage-enter, .q3-fade-up, .q3-scale-in, .q3-cell-pop,
          .q3-slide-down, .q3-flicker, .q3-cell-glow,
          .q3-bg-root::before, .q3-bg-root::after, .q3-bg-sweep {
            animation: none !important;
          }
        }
      `}</style>
      {keywordCleared ? (
        <PrivilegeScreen errorMessage={errorMessage} />
      ) : (
        <IndoorSearchScreen errorMessage={errorMessage} />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  PHASE_01: Indoor Search wireframe                                         */
/* -------------------------------------------------------------------------- */

function IndoorSearchScreen({ errorMessage }: { errorMessage: string | null }) {
  const { t } = useTranslation();
  return (
    <PageShell sessionId="ID: X-99">
      <div key="phase-1" className="q3-stage-enter">
        <IrisHaloAvatar />
        <NarrativeCard>{t("q3.narrative")}</NarrativeCard>

        <Form
          method="post"
          viewTransition
          className="mx-auto mt-8 mb-24 w-full max-w-md space-y-8"
        >
          <KeywordPhase />
          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
          <ExecuteDecryptButton />
        </Form>

        <HintChat hint={t("q3.phase1Hint")} />
      </div>
    </PageShell>
  );
}

function IrisHaloAvatar() {
  return (
    <div className="relative mx-auto mb-6 flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-cyan-400/20 shadow-[0_0_30px_rgba(0,240,255,0.1)]" />
      <div className="absolute inset-2 rotate-45 rounded-full border border-dashed border-cyan-400/40" />
      <div className="absolute inset-4 rounded-full border border-cyan-400/60 shadow-[inset_0_0_20px_rgba(0,240,255,0.2)]" />
      <div className="absolute h-8 w-8 rounded-full bg-cyan-400 opacity-80 blur-md" />
      <div className="absolute h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_20px_#00f0ff]" />
    </div>
  );
}

function CornerBrackets() {
  return (
    <>
      <span className="pointer-events-none absolute -top-px -left-px h-2 w-2 border-t border-l border-cyan-400" />
      <span className="pointer-events-none absolute -top-px -right-px h-2 w-2 border-t border-r border-cyan-400" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-2 w-2 border-b border-l border-cyan-400" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 border-b border-r border-cyan-400" />
    </>
  );
}

function NarrativeCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-md border border-outline-variant bg-surface-container-low/40 p-6 text-center backdrop-blur-md">
      <CornerBrackets />
      <p className="font-mono text-sm leading-relaxed tracking-wider text-on-surface-variant">
        {children}
      </p>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container px-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
        SYS.MSG_RECV
      </span>
    </div>
  );
}

function KeywordPhase() {
  const { t } = useTranslation();
  return (
    <div className="relative border border-outline-variant bg-surface-container-low/60 p-6 backdrop-blur-md">
      <CornerBrackets />
      <div className="mb-4 flex items-center justify-between border-b border-outline-variant/50 pb-2">
        <div className="flex items-center gap-2 text-cyan-400">
          <Icon name="search" className="text-base" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            PHASE_01
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
          REQ: HIRAGANA
        </span>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="q3-keyword"
          className="block font-mono text-sm tracking-wider text-on-surface-variant"
        >
          {t("q3.keywordLabel")}
        </label>
        <div className="relative flex items-center">
          <span className="mr-2 font-mono text-cyan-400 opacity-50">&gt;</span>
          <input
            id="q3-keyword"
            name="keyword"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="AWAITING_INPUT..."
            required
            autoFocus
            className="w-full border-0 border-b border-cyan-700 bg-transparent py-2 font-mono text-base text-cyan-400 placeholder:text-cyan-700/50 focus:border-cyan-400 focus:outline-none focus:ring-0"
          />
        </div>
      </div>
    </div>
  );
}

function ExecuteDecryptButton() {
  return (
    <button
      type="submit"
      className="group relative w-full overflow-hidden border border-cyan-400 bg-transparent px-6 py-4 transition-all duration-300 hover:bg-cyan-400/10"
    >
      <div className="absolute inset-0 translate-y-full bg-cyan-400/20 transition-transform duration-300 ease-out group-hover:translate-y-0" />
      <span className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-400" />
      <span className="relative z-10 inline-flex items-center justify-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
        <Icon name="terminal" className="text-base" />
        EXECUTE_DECRYPT
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  PHASE_02: Privilege Escalation wireframe                                  */
/* -------------------------------------------------------------------------- */

function PrivilegeScreen({ errorMessage }: { errorMessage: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="q3-bg-root">
      <div className="q3-bg-noise" />
      <div className="q3-bg-sweep" />
      <PageShell sessionId="CORE_DECRYPTION_MODULE">
        <div key="phase-2" className="relative z-10 space-y-8">
          <div className="q3-slide-down">
            <Phase01CompletedBanner />
          </div>

          <section className="flex flex-col items-center space-y-6">
            <div className="q3-scale-in" style={{ animationDelay: "200ms" }}>
              <PrivilegeIrisAvatar />
            </div>
            <div
              className="q3-fade-up w-full"
              style={{ animationDelay: "500ms" }}
            >
              <PrivilegeIrisMessage />
            </div>
          </section>

          <Form method="post" viewTransition className="mb-24 space-y-6 pt-4">
            <div className="q3-fade-up" style={{ animationDelay: "700ms" }}>
              <Phase02Header />
            </div>
            <CodeSegmentedInput />
            {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
            <div className="q3-fade-up" style={{ animationDelay: "1500ms" }}>
              <Phase02StatusLine />
            </div>
            <div className="q3-fade-up" style={{ animationDelay: "1700ms" }}>
              <InitializeVerificationButton />
            </div>
          </Form>

          <div className="q3-fade-up" style={{ animationDelay: "1900ms" }}>
            <DecorativeSystemMeta />
          </div>

          <HintChat hint={t("q3.phase2Hint")} />
        </div>
      </PageShell>
    </div>
  );
}

function Phase01CompletedBanner() {
  const { t } = useTranslation();
  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/60">
          PHASE_01: KEYWORD_AUTH
        </span>
        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
          STATUS: COMPLETED
        </span>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-surface-container-lowest/60 p-4 backdrop-blur-md">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
            {t("q3.phase1InputData")}
          </span>
          <span className="font-mono tracking-widest text-cyan-100">
            ********
          </span>
        </div>
        <Icon name="check_circle" filled className="text-2xl text-cyan-400" />
      </div>
    </section>
  );
}

function PrivilegeIrisAvatar() {
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      {/* Outer pulsing ring */}
      <div className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border border-cyan-400/20" />
      <div className="absolute inset-0 animate-pulse rounded-full border border-cyan-400/10 shadow-[0_0_60px_rgba(0,240,255,0.15)]" />
      {/* Mid dashed ring rotating reverse */}
      <div className="absolute inset-3 animate-[spin_7s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-400/40" />
      {/* Inner solid ring */}
      <div className="absolute inset-6 flex items-center justify-center rounded-full border-2 border-cyan-400/60 shadow-[inset_0_0_24px_rgba(0,240,255,0.25)]">
        <div className="absolute h-12 w-12 animate-pulse rounded-full bg-cyan-400/25 blur-md" />
        <Icon
          name="lens_blur"
          filled
          className="q3-flicker text-4xl text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,0.85)]"
        />
      </div>
      {/* Orbiting particles */}
      <span
        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.9)]"
        style={{ animation: "q3-orbit 5s linear infinite" }}
      />
      <span
        className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-cyan-200/80"
        style={{ animation: "q3-orbit-rev 3.5s linear infinite" }}
      />
    </div>
  );
}

function PrivilegeIrisMessage() {
  const { t } = useTranslation();
  return (
    <div className="relative w-full overflow-hidden border-l-2 border-cyan-400 bg-surface-container-low/40 p-5 backdrop-blur-md">
      {/* Internal scanline gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 50%, rgba(0,240,255,0.4) 51%, transparent 52%)",
          backgroundSize: "100% 4px",
        }}
      />
      <span className="absolute right-1 top-1 font-mono text-[8px] text-cyan-900/50">
        IRIS_SYS_COMM_v4.2
      </span>
      <p className="relative text-sm leading-relaxed text-on-surface">
        {t("q3.privilegeMessage")}
        <span
          className="ml-1 inline-block h-3 w-2 align-middle bg-cyan-400"
          style={{ animation: "q3-flicker 1s steps(2) infinite" }}
        />
      </p>
      <span className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-400/50" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-400/50" />
    </div>
  );
}

function Phase02Header() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400">
        PHASE_02: ACCESS_KEY_REQUIRED
      </span>
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </div>
  );
}

function CodeSegmentedInput() {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current = refs.current.slice(0, CODE_LENGTH);
    // 初回フォーカスは enter アニメ完了後に遅延
    const id = window.setTimeout(() => refs.current[0]?.focus(), 1400);
    return () => window.clearTimeout(id);
  }, []);

  const handleInput = (i: number) => (e: React.FormEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value.replace(/\D/g, "").slice(-1);
    e.currentTarget.value = v;
    if (v && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
  };
  const handleKeyDown =
    (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !e.currentTarget.value && i > 0) {
        refs.current[i - 1]?.focus();
      }
    };

  return (
    <div className="flex items-center justify-center gap-4">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <div key={i} className="contents">
          {i === 1 && (
            <span
              className="q3-cell-pop self-end pb-2 font-mono text-2xl font-bold text-cyan-400 select-none"
              style={{ animationDelay: "970ms" }}
            >
              .
            </span>
          )}
          <div
            className="q3-cell-pop relative"
            style={{ animationDelay: `${900 + i * 140}ms` }}
          >
            {/* Glow halo behind cell */}
            <div
              className="q3-cell-glow absolute -inset-px rounded-sm"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              name={`code_${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              autoComplete="off"
              required
              placeholder="_"
              onInput={handleInput(i)}
              onKeyDown={handleKeyDown(i)}
              className="relative h-20 w-14 rounded-sm border border-cyan-500/50 bg-surface-container-highest/30 text-center font-display text-3xl font-bold text-cyan-300 shadow-[inset_0_0_18px_rgba(0,240,255,0.08)] outline-none transition-colors placeholder:text-cyan-900/40 focus:border-cyan-300 focus:bg-cyan-500/15 focus:text-cyan-200 focus:ring-2 focus:ring-cyan-400 focus:shadow-[0_0_18px_rgba(0,240,255,0.45),inset_0_0_18px_rgba(0,240,255,0.25)]"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Phase02StatusLine() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
      {t("q3.waitingOverride")}
    </div>
  );
}

function InitializeVerificationButton() {
  return (
    <button
      type="submit"
      className="group relative w-full overflow-hidden border border-cyan-400/50 bg-cyan-400/5 py-4 font-mono text-sm uppercase tracking-widest text-cyan-400 transition-all duration-300 hover:bg-cyan-400/10"
    >
      <span className="relative z-10">Initialize Verification</span>
      <div className="absolute inset-0 -translate-x-full bg-cyan-400/10 transition-transform duration-500 ease-out group-hover:translate-x-0" />
    </button>
  );
}

function DecorativeSystemMeta() {
  return (
    <div className="grid grid-cols-2 gap-4 pt-4 opacity-50">
      <div className="border-t border-cyan-900/30 pt-2">
        <span className="block font-mono text-[8px] uppercase tracking-widest text-cyan-800">
          SYSTEM_LOAD
        </span>
        <div className="mt-1 flex items-center gap-0.5">
          <div
            className="h-1 w-2 bg-cyan-400"
            style={{ animation: "q3-flicker 2.4s ease-in-out infinite" }}
          />
          <div
            className="h-1 w-2 bg-cyan-400"
            style={{ animation: "q3-flicker 2.4s ease-in-out infinite 0.3s" }}
          />
          <div
            className="h-1 w-2 bg-cyan-400"
            style={{ animation: "q3-flicker 2.4s ease-in-out infinite 0.6s" }}
          />
          <div className="h-1 w-2 bg-cyan-400/20" />
          <div className="h-1 w-2 bg-cyan-400/20" />
        </div>
      </div>
      <div className="flex flex-col items-end border-t border-cyan-900/30 pt-2">
        <span className="block font-mono text-[8px] uppercase tracking-widest text-cyan-800">
          TRACE_COORDS
        </span>
        <span
          className="q3-flicker font-mono text-[8px] uppercase tracking-widest text-cyan-600"
          style={{ animationDuration: "4s" }}
        >
          35.6895° N, 139.6917° E
        </span>
      </div>
    </div>
  );
}
