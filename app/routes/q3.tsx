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

const CODE_LENGTH = 4;

type ActionResult =
  | { ok: false; phase: "keyword" | "code"; message: string }
  | { ok: true };

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  // 既に keyword クリア済み (currentStage === "Q3_CODE") のときは Phase 1 を完了表示にする
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
  let user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();

  // Phase 1: keyword（未クリアのときのみ評価）
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
    user = t.user;
    if (!kwCorrect) {
      return {
        ok: false,
        phase: "keyword",
        message: "PHASE_01 認証失敗。キーワードを再確認してください。",
      };
    }
  }

  // Phase 2: code（keyword 突破後）
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
    user = t.user;
    if (!codeCorrect) {
      return {
        ok: false,
        phase: "code",
        message: "PHASE_02 コード不一致。4 桁の数字を再確認してください。",
      };
    }
  }

  if (user.currentStage === "Q4") throw redirect("/q4");
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
    <PageShell sessionId="ID: X-99">
      <BackAction />
      <IrisAvatar />
      <NarrativeCard />

      <Form method="post" className="mx-auto mt-8 w-full max-w-md space-y-8">
        <KeywordPhase cleared={keywordCleared} />
        <CircuitConnector />
        <CodePhase />
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <ExecuteButton />
      </Form>

      <HintChat hint="STAGE 03 / PHASE_01 はことわざ『掃き溜めに鶴』のローマ字（ヘボン式・半角小文字）。PHASE_02 は『黄金』にまつわる定数の最初の 4 桁を、小数点を除いて半角数字で順に入力してください。両方一致したときだけ次に進めます。" />
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

function IrisAvatar() {
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

function NarrativeCard() {
  return (
    <div className="relative mx-auto max-w-md border border-outline-variant bg-surface-container-low/40 p-6 text-center backdrop-blur-md">
      <CornerBrackets />
      <p className="font-mono text-sm leading-relaxed tracking-wider text-on-surface-variant">
        &quot;Check the bin in the corner. Sato used to hide notes there. A
        numeric code is needed to unlock highest privilege.&quot;
      </p>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container px-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
        SYS.MSG_RECV
      </span>
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

function PhaseHeader({
  icon,
  label,
  req,
  cleared,
}: {
  icon: string;
  label: string;
  req: string;
  cleared?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-outline-variant/50 pb-2">
      <div className="flex items-center gap-2 text-cyan-400">
        <Icon name={icon} className="text-base" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
        {cleared ? "CLEARED" : req}
      </span>
    </div>
  );
}

function KeywordPhase({ cleared }: { cleared: boolean }) {
  return (
    <div className="relative border border-outline-variant bg-surface-container-low/60 p-6 backdrop-blur-md">
      <CornerBrackets />
      <PhaseHeader
        icon="search"
        label="PHASE_01"
        req="REQ: ALPHANUM"
        cleared={cleared}
      />
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
            placeholder={cleared ? "✓ CLEARED" : "AWAITING_INPUT..."}
            disabled={cleared}
            required={!cleared}
            className="w-full border-0 border-b border-cyan-700 bg-transparent py-2 font-mono text-base uppercase tracking-[0.2em] text-cyan-400 placeholder:text-cyan-700/50 focus:border-cyan-400 focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}

function CircuitConnector() {
  return (
    <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
  );
}

function CodePhase() {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // 1 桁入力したら次へ自動フォーカス、Backspace で前へ戻る
  useEffect(() => {
    refs.current = refs.current.slice(0, CODE_LENGTH);
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
    <div className="relative border border-outline-variant bg-surface-container-low/60 p-6 backdrop-blur-md">
      <CornerBrackets />
      <PhaseHeader icon="lock_open" label="PHASE_02" req="REQ: 4_DIGIT_NUM" />
      <div className="space-y-4">
        <p className="font-mono text-sm tracking-wider text-on-surface-variant">
          Enter 4-significant-digit code
        </p>
        <div className="flex justify-between gap-2">
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
              className="w-full bg-surface border border-outline-variant py-4 text-center font-display text-3xl font-bold text-cyan-400 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] outline-none transition-colors placeholder:text-surface-bright focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 md:text-5xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExecuteButton() {
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
