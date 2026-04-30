import { drizzle } from "drizzle-orm/d1";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import {
  DowsingCard,
  ErrorAlert,
  GlowButton,
  HintChat,
  Icon,
  PageShell,
  StageHeader,
  SystemPanel,
  TextInput,
} from "~/components";
import { FREQ_Q1_1_HZ } from "~/lib/dowsing/config";
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
import { applyQ1Answer, unlockedSub } from "~/lib/participant/transitions";
import type { Route } from "./+types/q1.1";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  if (unlockedSub(user) !== "Q1_1") throw redirect("/q1");

  const db = drizzle(env.DB);
  const answered = await hasCorrectAttempt(db, user.groupId, "Q1_1");
  return { answered };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const rawX = String(formData.get("x") ?? "");
  const rawY = String(formData.get("y") ?? "");
  const raw = `${rawX},${rawY}`;
  // x と y をそれぞれ正規化してから連結することで、全角カンマ等の表記揺れを回避する
  const normalized = `${normalize(rawX)},${normalize(rawY)}`;
  const correct = isCorrect("Q1_1", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ1Answer(user, "Q1_1", correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q1_1",
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

export default function Q1_1() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const showCheckpointPrompt = data.answered || actionData?.ok === true;

  if (showCheckpointPrompt) {
    return <CheckpointPrompt />;
  }

  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="DECRYPTION 1-1" eyebrow="MODULE: SIGNAL RECOVERY">
        <p>連立方程式を解いて、x と y の値を入力してください。</p>
      </StageHeader>

      <SystemPanel className="my-6">
        <div className="flex items-start gap-3">
          <Icon
            name="terminal"
            className="mt-0.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(0,240,255,0.5)]"
          />
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              [MESSAGE_INCOMING]
            </p>
            <p className="font-mono text-sm leading-relaxed text-on-surface">
              [EQUATION_LOG] 二つの方程式を同時に満たす解を求め、x と y
              の値をそれぞれ入力してください。
            </p>
          </div>
        </div>
      </SystemPanel>

      <SystemPanel className="my-6">
        <img
          src="/q1-1-equations.png"
          alt="EQ_01: 2x + 3 = 11, EQ_02: y - 4x = -10"
          className="mx-auto block w-full max-w-sm"
        />
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          SOLUTION
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="q1-1-x"
              className="block font-mono text-[10px] uppercase tracking-widest text-cyan-500/70"
            >
              X
            </label>
            <div className="mt-1 flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
              <span className="mr-2 font-mono text-sm font-bold text-cyan-500">
                x =
              </span>
              <TextInput
                id="q1-1-x"
                name="x"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="0"
                required
                className="border-0 focus:ring-0"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="q1-1-y"
              className="block font-mono text-[10px] uppercase tracking-widest text-cyan-500/70"
            >
              Y
            </label>
            <div className="mt-1 flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
              <span className="mr-2 font-mono text-sm font-bold text-cyan-500">
                y =
              </span>
              <TextInput
                id="q1-1-y"
                name="y"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                required
                className="border-0 focus:ring-0"
              />
            </div>
          </div>
        </div>
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          SUBMIT_SEQUENCE
        </GlowButton>
      </Form>

      <Link
        to="/q1"
        className="mt-8 inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-cyan-900 hover:text-cyan-400"
      >
        <Icon name="arrow_back" className="text-sm" /> BACK TO HUB
      </Link>

      <HintChat hint="DECRYPTION 1-1 は連立方程式 EQ_01 / EQ_02 の解です。EQ_01 から x を求め、その x を EQ_02 に代入して y を求めてください。x と y の両方が一致したときのみ次に進めます。" />
    </PageShell>
  );
}

function CheckpointPrompt() {
  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="DECRYPTION 1-1 — UNLOCKED" eyebrow="STATUS">
        <p>
          解答を受領しました。会場のチェックポイントに向かい、設置された QR
          をスキャンして物理認証を完了してください。
        </p>
      </StageHeader>

      <div className="my-6 flex flex-col items-center gap-3">
        <Icon
          name="qr_code_scanner"
          className="text-6xl text-cyan-400 drop-shadow-[0_0_20px_rgba(0,240,255,0.4)]"
        />
        <p className="font-mono text-sm uppercase tracking-widest text-cyan-400">
          AWAITING PHYSICAL VERIFICATION
        </p>
      </div>

      <DowsingCard targetFreqHz={FREQ_Q1_1_HZ} label="DOWSING Q1-1" />

      <Link
        to="/q1"
        className="mt-4 inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-cyan-400"
      >
        <Icon name="arrow_back" className="text-sm" /> BACK TO HUB
      </Link>
    </PageShell>
  );
}
