import { drizzle } from "drizzle-orm/d1";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
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
        message: "認証失敗。入力値を再確認してください。",
      } as const);
}

export default function Q2() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const showCheckpointPrompt = data.answered || actionData?.ok === true;

  if (showCheckpointPrompt) {
    return (
      <PageShell sessionId="ID: X-99">
        <StageHeader title="STAGE 02 — DECRYPTED" eyebrow="STATUS">
          <p>
            解答を受領しました。会場のチェックポイントに向かい、設置された QR
            をスキャンして物理認証を完了してください。
          </p>
        </StageHeader>

        <div className="my-8 flex flex-col items-center gap-3">
          <Icon
            name="qr_code_scanner"
            className="text-6xl text-cyan-400 drop-shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          />
          <p className="font-mono text-sm uppercase tracking-widest text-cyan-400">
            AWAITING PHYSICAL VERIFICATION
          </p>
        </div>
      </PageShell>
    );
  }

  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <PageShell sessionId="ID: X-99" widthClass="max-w-5xl">
      <StageHeader title="STAGE 02" eyebrow="KEY TRANSFORMER">
        <p>
          神のAI通称アーテは私の上位互換として、完成したら今の私に覆いかぶさるように、私とつなげて作られています。
        </p>
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

      <Link
        to="/q1"
        className="mt-8 inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-cyan-900 hover:text-cyan-400"
      >
        <Icon name="arrow_back" className="text-sm" /> BACK
      </Link>

      <HintChat hint="STAGE 02 は『佐藤のメモ』に記された かな の並びを、キーボード上で同じ位置にある英数字に置き換える設問です。半角小文字で入力し、記号やスペースは含めないでください。" />
    </PageShell>
  );
}

function IrisMessageCard() {
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
            IRIS_MESSAGE
          </span>
        </div>
        <p className="text-sm leading-relaxed text-on-surface">
          佐藤ディレクターは認証キーを書き換えました ——
          物理キーボードそのものをコンバーターとして利用しています。
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
  return (
    <SystemPanel className="border-l-2 border-cyan-400/40 bg-cyan-950/10">
      <div className="mb-4 flex items-center gap-2 text-cyan-400/70">
        <Icon name="description" className="text-sm" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          RECOVERED_MEMO: SATO_W
        </span>
      </div>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex flex-col gap-1 border-b border-cyan-900/30 pb-2">
          <span className="text-cyan-700">佐藤渉（さとうわたる）</span>
          <span className="ml-2 text-sm text-cyan-400">→ xs40q.</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-cyan-700">石油（せきゆ）</span>
          <span className="ml-2 text-sm text-cyan-400">→ pru</span>
        </div>
      </div>
    </SystemPanel>
  );
}

function AttemptLimitCard() {
  return (
    <SystemPanel className="border-l-4 border-l-error/60">
      <div className="mb-2 flex items-center gap-2 text-error">
        <Icon name="warning" className="text-sm" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          警告: 入力試行制限
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
  return (
    <div className="relative bg-[#05070A]/40 backdrop-blur-md border border-cyan-900/40 p-6 md:p-8">
      <span className="pointer-events-none absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2 border-cyan-400" />
      <span className="pointer-events-none absolute -bottom-2 -right-2 h-6 w-6 border-b-2 border-r-2 border-cyan-400" />

      {/* DECODE_TARGET_WORD: 変換前のかな文字列を中央大表示（stitch準拠） */}
      <div className="mb-12 text-center">
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500/50">
          DECODE_TARGET_WORD
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
            Auth Key Input (English Only)
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
              placeholder="キーを入力..."
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
            AUTHENTICATE SYSTEM
          </span>
          <Icon name="login" className="text-base" />
        </button>
      </Form>
    </div>
  );
}
