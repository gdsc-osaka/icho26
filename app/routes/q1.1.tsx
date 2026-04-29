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
  const raw = String(formData.get("answer") ?? "");
  const normalized = normalize(raw);
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
        <p>連立方程式を解いて、求めた値を入力してください。</p>
      </StageHeader>

      <SystemPanel className="my-8 text-center">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
          EQUATION INPUT
        </p>
        <div className="space-y-4 py-2">
          <p className="font-display text-2xl tracking-widest text-primary drop-shadow-[0_0_8px_rgba(219,252,255,0.3)]">
            設問の方程式を解け
          </p>
        </div>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          ANSWER
        </label>
        <div className="flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
          <Icon
            name="arrow_forward_ios"
            className="mr-2 text-sm text-cyan-500"
          />
          <TextInput
            name="answer"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="ENTER VALUE"
            required
            className="border-0 focus:ring-0"
          />
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

      <HintChat hint="DECRYPTION 1-1 は連立方程式の解です。会場で配布された資料の式を整理し、求まった数値そのものを半角で入力してください。単位記号は不要です。" />
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
