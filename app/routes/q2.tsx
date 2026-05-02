import { drizzle } from "drizzle-orm/d1";
import { useTranslation } from "react-i18next";
import { Form, redirect, useActionData, useLoaderData } from "react-router";
import {
  ErrorAlert,
  HintChat,
  Icon,
  PageShell,
  StageHeader,
  SystemPanel,
  TextInput,
} from "~/components";
import { isCorrect } from "~/lib/participant/judge";
import { applyTransition } from "~/lib/participant/mutations";
import { normalize } from "~/lib/participant/normalize";
import {
  findUserByGroupId,
  hasCorrectAttempt,
} from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  requireParticipant,
} from "~/lib/participant/session";
import { applyQ2Answer } from "~/lib/participant/transitions";
import type { Route } from "./+types/q2";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  const db = drizzle(env.DB);
  const answered = await hasCorrectAttempt(db, user.groupId, "Q2");
  return { answered };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const raw = String(formData.get("answer") ?? "");
  const normalized = normalize(raw);
  const correct = isCorrect("Q2", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ2Answer(user, correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q2",
      rawInput: raw,
      normalizedInput: normalized,
      correct: correct ? 1 : 0,
      createdAt: now,
    },
    now,
  );

  return correct
    ? ({ ok: true } as const)
    : ({
        ok: false,
        messageKey: "errors.authFailed",
      } as const);
}

export default function Q2() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const showCheckpointPrompt = data.answered || actionData?.ok === true;

  if (showCheckpointPrompt) {
    return <Q2DecryptedScan />;
  }

  const errorMessage =
    actionData?.ok === false ? t(actionData.messageKey) : null;

  return (
    <PageShell sessionId="ID: X-99" widthClass="max-w-5xl">
      <StageHeader title={t("q2.stageTitle")} eyebrow={t("q2.moduleLabel")}>
        <p>{t("q2.instruction")}</p>
      </StageHeader>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Sidebar: Iris message / recovered memo / warning */}
        <aside className="w-full space-y-6 lg:w-1/3">
          <IrisMessageCard />
          <RecoveredMemoCard />
          <AttemptLimitCard />
        </aside>

        {/* Main: decode form */}
        <section className="w-full flex-1 space-y-8">
          <DecodePanel errorMessage={errorMessage} />
        </section>
      </div>

      <HintChat hint={t("q2.hint")} />
    </PageShell>
  );
}

function Q2DecryptedScan() {
  const { t } = useTranslation();
  return (
    <PageShell sessionId="UPLINK_STABLE" rightIcon="settings_input_antenna">
      <div className="mb-6 space-y-2 animate-verify-fade-up">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-cyan-400" />
          </span>
          <span className="font-['Space_Grotesk'] text-cyan-400 text-xs tracking-widest uppercase text-glow-cyan">
            AUTH_SUCCESS: [ coffeecup ]
          </span>
        </div>
        <h2 className="text-primary text-2xl font-bold leading-tight">
          {t("q2.authSuccessHeading")}
          <br />
          <span className="opacity-70 text-lg font-normal">
            {t("q2.authSuccessSub")}
          </span>
        </h2>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center relative my-4">
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-[300px] h-[300px] border border-cyan-500/20 rounded-full absolute animate-verify-ring-reverse" />
          <div className="absolute w-[400px] h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="absolute w-px h-[400px] bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
        </div>

        <div
          className="absolute w-64 h-64 rounded-full border border-cyan-400/40 animate-verify-pulse-ring pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute w-64 h-64 rounded-full border border-cyan-400/30 animate-verify-pulse-ring pointer-events-none"
          style={{ animationDelay: "1.3s" }}
          aria-hidden="true"
        />

        <div className="relative w-64 h-64 flex items-center justify-center bg-[#05070A]/40 backdrop-blur-md border border-cyan-500/40 rounded-full overflow-hidden animate-verify-glow-breath">
          <span className="absolute top-[-1px] left-[-1px] w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
          <span className="absolute top-[-1px] right-[-1px] w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          <span className="absolute bottom-[-1px] left-[-1px] w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
          <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-verify-scan-sweep" />
          </div>

          <svg
            className="absolute inset-0 w-full h-full animate-verify-ring"
            aria-hidden="true"
          >
            <circle
              cx="50%"
              cy="50%"
              fill="transparent"
              r="46%"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 8"
              className="text-cyan-400/40"
            />
          </svg>
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50%"
              cy="50%"
              fill="transparent"
              r="48%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan-500/10"
            />
            <circle
              cx="50%"
              cy="50%"
              fill="transparent"
              r="48%"
              stroke="currentColor"
              strokeDasharray="300"
              strokeDashoffset="100"
              strokeWidth="2"
              className="text-cyan-400 iris-glow"
            />
          </svg>

          <div className="relative z-10 flex flex-col items-center">
            <Icon
              name="nfc"
              className="text-cyan-400 animate-pulse"
              style={{ fontSize: "5rem" }}
            />
            <Icon
              name="coffee"
              className="mt-4 text-cyan-400/50"
              style={{ fontSize: "1.875rem" }}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        </div>

        <div
          className="mt-10 text-center space-y-4 max-w-xs mx-auto animate-verify-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <p className="whitespace-pre-line text-on-surface text-sm leading-relaxed">
            {t("q2.scanInstruction")}
          </p>

          <div className="space-y-2">
            <div className="flex justify-between font-['Space_Grotesk'] text-[10px] text-cyan-400/70 tracking-widest uppercase">
              <span className="animate-scan-progress-pulse">
                {t("q2.scanInProgress")}
              </span>
              <span>42%</span>
            </div>
            <div className="relative h-1.5 w-full bg-slate-900 border border-cyan-500/20 overflow-hidden">
              <div className="absolute inset-0 flex gap-0.5 p-0.5">
                <div className="h-full w-1/6 bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-scan-segment-flicker" />
                <div
                  className="h-full w-1/6 bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-scan-segment-flicker"
                  style={{ animationDelay: "0.2s" }}
                />
                <div className="h-full w-1/6 bg-cyan-400/40" />
                <div className="h-full w-1/6 bg-cyan-400/20" />
                <div className="h-full w-1/6 bg-transparent" />
                <div className="h-full w-1/6 bg-transparent" />
              </div>
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 animate-scan-progress" />
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-8 bg-[#05070A]/40 backdrop-blur-md p-4 animate-verify-fade-up"
        style={{
          animationDelay: "0.4s",
          border: "1px solid rgba(0,240,255,0.15)",
          borderLeft: "2px solid rgba(0,240,255,0.6)",
        }}
      >
        <div className="flex gap-3">
          <Icon name="info" className="text-cyan-400 text-lg shrink-0" />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {t("q2.nfcFallback")}
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function IrisMessageCard() {
  const { t } = useTranslation();
  return (
    <SystemPanel className="relative overflow-hidden">
      <div className="dowsing-scanline pointer-events-none absolute inset-0" />
      <div className="absolute right-0 top-0 border-b border-l border-cyan-500/30 px-1 font-mono text-[8px] text-cyan-500/50">
        IRIS_CORE_V4
      </div>
      <div className="relative">
        <div className="mb-3 flex items-center gap-2 text-cyan-400">
          <Icon name="emergency_home" filled className="text-sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            {t("q2.irisMessageLabel")}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface">
          {t("q2.irisMessage")}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-cyan-900/50 pt-3 font-mono text-[10px] uppercase tracking-widest text-cyan-700">
          <span>TRACE_ORIGIN: LOG_S_1993</span>
          <span>STATUS: ACTIVE</span>
        </div>
      </div>
      <style>{`
        .dowsing-scanline {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            transparent 49%,
            rgba(0, 240, 255, 0.08) 50%,
            transparent 51%,
            transparent 100%
          );
          background-size: 100% 6px;
          opacity: 0.6;
        }
      `}</style>
    </SystemPanel>
  );
}

function RecoveredMemoCard() {
  const { t } = useTranslation();
  return (
    <SystemPanel className="border-l-2 border-cyan-400/40 bg-cyan-950/10">
      <div className="mb-4 flex items-center gap-2 text-cyan-400/70">
        <Icon name="description" className="text-sm" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          {t("q2.memoLabel")}
        </span>
      </div>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex flex-col gap-1 border-b border-cyan-900/30 pb-2">
          <span className="text-cyan-700">{t("q2.memoNameLabel")}</span>
          <span className="ml-2 text-sm text-cyan-400">→ xs40q.</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-cyan-700">{t("q2.memoOilLabel")}</span>
          <span className="ml-2 text-sm text-cyan-400">→ pg8</span>
        </div>
      </div>
    </SystemPanel>
  );
}

function AttemptLimitCard() {
  const { t } = useTranslation();
  return (
    <SystemPanel className="border-l-4 border-l-error/60">
      <div className="mb-2 flex items-center gap-2 text-error">
        <Icon name="warning" className="text-sm" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          {t("q2.warningLabel")}
        </span>
      </div>
      {/* 静的バー: 動的に試行回数を反映する仕様ではなく、緊張感の演出 */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div className="h-full w-4/5 bg-error" />
      </div>
    </SystemPanel>
  );
}

function DecodePanel({ errorMessage }: { errorMessage: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="relative bg-[#05070A]/40 backdrop-blur-md border border-cyan-900/40 p-6 md:p-8">
      <span className="pointer-events-none absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2 border-cyan-400" />
      <span className="pointer-events-none absolute -bottom-2 -right-2 h-6 w-6 border-b-2 border-r-2 border-cyan-400" />

      {/* DECODE_TARGET_WORD: 変換前のかな文字列を中央大表示（stitch準拠） */}
      <div className="mb-12 text-center">
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/50">
          {t("q2.decodeTargetLabel")}
        </h3>
        <div className="inline-block rounded-2xl border border-cyan-400/20 bg-cyan-950/10 p-6 shadow-[inset_0_0_20px_rgba(0,240,255,0.05)] md:p-8">
          <div className="font-display text-4xl tracking-widest text-cyan-400 brightness-125 drop-shadow-[0_0_15px_rgba(0,240,255,0.5)] md:text-5xl">
            そらははいいそなせ
          </div>
        </div>
      </div>

      <Form method="post" className="mx-auto max-w-md space-y-8">
        <div>
          <label
            htmlFor="q2-answer"
            className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-cyan-600"
          >
            {t("q2.authKeyInputLabel")}
          </label>
          <div className="flex items-center border-b-2 border-cyan-900 py-3 transition-colors focus-within:border-cyan-400">
            <Icon
              name="arrow_forward_ios"
              className="mr-3 animate-pulse text-cyan-500"
            />
            <TextInput
              id="q2-answer"
              name="answer"
              inputMode="text"
              autoComplete="off"
              autoFocus
              placeholder={t("q2.authKeyInputPlaceholder")}
              required
              spellCheck={false}
              className="border-0 bg-transparent text-2xl tracking-widest text-cyan-400 focus:ring-0"
            />
          </div>
        </div>
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <button
          type="submit"
          className="group flex w-full items-center justify-center gap-3 border-2 border-cyan-400 bg-transparent px-6 py-5 font-display text-sm font-bold uppercase tracking-widest text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all duration-300 hover:bg-cyan-400 hover:text-[#05070A] hover:shadow-[0_0_25px_rgba(0,240,255,0.3)]"
        >
          <span className="transition-transform group-hover:translate-x-1">
            {t("q2.submitLabel")}
          </span>
          <Icon name="login" className="text-base" />
        </button>
      </Form>
    </div>
  );
}
