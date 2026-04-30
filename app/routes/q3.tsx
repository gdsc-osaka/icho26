import { drizzle } from "drizzle-orm/d1";
import { useEffect, useRef } from "react";
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

const CODE_LENGTH = 3;

type ActionResult =
  | { ok: false; phase: "keyword" | "code"; message: string }
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
        message: "PHASE_01 認証失敗。キーワードを再確認してください。",
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
        message: "PHASE_02 コード不一致。3 桁の数字を再確認してください。",
      };
    }
    if (t.user.currentStage === "Q4") throw redirect("/q4");
  }

  return {
    ok: false,
    phase: "keyword",
    message: "想定外の状態です。",
  };
}

export default function Q3() {
  const { keywordCleared } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <>
      {/* CSS-only stage transition: each screen fades + slides in on mount.
         View Transitions API (Form viewTransition) provides cross-browser
         blending; this keyframe is the safe fallback. */}
      <style>{`
        @keyframes q3-stage-enter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        .q3-stage-enter {
          animation: q3-stage-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .q3-stage-enter { animation: none; }
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
  return (
    <PageShell sessionId="ID: X-99">
      <div key="phase-1" className="q3-stage-enter">
        <BackAction />
        <IrisHaloAvatar />
        <NarrativeCard>
          &quot;Check the bin in the corner. Sato used to hide notes there. A
          numeric code is needed to unlock highest privilege.&quot;
        </NarrativeCard>

        <Form
          method="post"
          viewTransition
          className="mx-auto mt-8 w-full max-w-md space-y-8"
        >
          <KeywordPhase />
          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
          <ExecuteDecryptButton />
        </Form>

        <HintChat hint="STAGE 03 / PHASE_01 はことわざ『掃き溜めに鶴』のローマ字（ヘボン式・半角小文字）。クリアすると PHASE_02 が解放されます。" />
      </div>
    </PageShell>
  );
}

function BackAction() {
  return (
    <button
      type="button"
      onClick={() => history.back()}
      className="group mb-6 inline-flex items-center gap-2 self-start font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-500 hover:text-cyan-400"
    >
      <Icon
        name="arrow_back"
        className="text-base transition-transform group-hover:-translate-x-1"
      />
      ABORT_SEQUENCE
    </button>
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
          REQ: ALPHANUM
        </span>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="q3-keyword"
          className="block font-mono text-sm tracking-wider text-on-surface-variant"
        >
          Enter keyword found in room
        </label>
        <div className="relative flex items-center">
          <span className="mr-2 font-mono text-cyan-400 opacity-50">&gt;</span>
          <input
            id="q3-keyword"
            name="keyword"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="AWAITING_INPUT..."
            required
            autoFocus
            className="w-full border-0 border-b border-cyan-700 bg-transparent py-2 font-mono text-base uppercase tracking-[0.2em] text-cyan-400 placeholder:text-cyan-700/50 focus:border-cyan-400 focus:outline-none focus:ring-0"
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
  return (
    <PageShell sessionId="CORE_DECRYPTION_MODULE">
      <div key="phase-2" className="q3-stage-enter space-y-8">
        <Phase01CompletedBanner />
        <PrivilegeIrisSection />

        <Form method="post" viewTransition className="space-y-6 pt-4">
          <Phase02Header />
          <CodeSegmentedInput />
          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
          <Phase02StatusLine />
          <InitializeVerificationButton />
        </Form>

        <DecorativeSystemMeta />

        <HintChat hint="STAGE 03 / PHASE_02 は『掃き溜めに鶴』にちなんだ数字コードです。3 桁を探して順に入力してください。" />
      </div>
    </PageShell>
  );
}

function Phase01CompletedBanner() {
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
            Input Data
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

function PrivilegeIrisSection() {
  return (
    <section className="flex flex-col items-center space-y-6">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border border-cyan-400/20" />
        <div className="absolute inset-2 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-cyan-400/40" />
        <div className="absolute inset-4 flex items-center justify-center rounded-full border-2 border-cyan-400/60">
          <div className="absolute h-8 w-8 animate-pulse rounded-full bg-cyan-400/20 blur-sm" />
          <Icon
            name="lens_blur"
            filled
            className="text-3xl text-cyan-400 drop-shadow-[0_0_15px_rgba(0,240,255,0.6)]"
          />
        </div>
      </div>

      <div className="relative w-full overflow-hidden border-l-2 border-cyan-400 bg-surface-container-low/40 p-5 backdrop-blur-md">
        <span className="absolute right-1 top-1 font-mono text-[8px] text-cyan-900/50">
          IRIS_SYS_COMM_v4.2
        </span>
        <p className="text-sm leading-relaxed text-on-surface">
          掃き溜めに鶴……ごみの中にも素敵なものがあることを表すことわざです。アプリのさらなる上級権限を開放するには数字のコードが必要です。3
          桁を探してみてください
        </p>
        <span className="pointer-events-none absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-400/50" />
        <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-cyan-400/50" />
      </div>
    </section>
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
    refs.current[0]?.focus();
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
    <div className="flex justify-center gap-4">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          name={`code_${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete="off"
          required
          placeholder="0"
          onInput={handleInput(i)}
          onKeyDown={handleKeyDown(i)}
          className="h-20 w-14 rounded-sm border border-cyan-500/40 bg-surface-container-highest/20 text-center font-display text-3xl font-bold text-cyan-400 outline-none transition-colors placeholder:text-cyan-900/30 focus:border-cyan-400 focus:bg-cyan-500/10 focus:ring-1 focus:ring-cyan-400"
        />
      ))}
    </div>
  );
}

function Phase02StatusLine() {
  return (
    <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
      Waiting for manual override sequence...
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
    <div className="grid grid-cols-2 gap-4 pt-4 opacity-40">
      <div className="border-t border-cyan-900/30 pt-2">
        <span className="block font-mono text-[8px] uppercase tracking-widest text-cyan-800">
          SYSTEM_LOAD
        </span>
        <div className="mt-1 flex gap-0.5">
          <div className="h-1 w-2 bg-cyan-400" />
          <div className="h-1 w-2 bg-cyan-400" />
          <div className="h-1 w-2 bg-cyan-400" />
          <div className="h-1 w-2 bg-cyan-400/20" />
          <div className="h-1 w-2 bg-cyan-400/20" />
        </div>
      </div>
      <div className="flex flex-col items-end border-t border-cyan-900/30 pt-2">
        <span className="block font-mono text-[8px] uppercase tracking-widest text-cyan-800">
          TRACE_COORDS
        </span>
        <span className="font-mono text-[8px] uppercase tracking-widest text-cyan-600">
          35.6895° N, 139.6917° E
        </span>
      </div>
    </div>
  );
}
