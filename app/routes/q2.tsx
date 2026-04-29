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
  GlowButton,
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
    <PageShell sessionId="ID: X-99">
      <StageHeader title="STAGE 02" eyebrow="KEY TRANSFORMER">
        <p>
          神のAI通称アーテは私の上位互換として、完成したら今の私に覆いかぶさるように、私とつなげて作られています。
        </p>
      </StageHeader>

      <SystemPanel className="my-8 border-l-2 border-cyan-400 bg-cyan-950/10">
        <div className="mb-3 flex items-center gap-2 text-cyan-400">
          <Icon name="emergency_home" filled className="text-sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            IRIS_MESSAGE
          </span>
        </div>
        <p className="text-sm leading-relaxed text-on-surface">
          AI開発本部長の佐藤さんは倒産直前、認証キーを書き換えました。彼は、物理的なキーボードそのものを『変換機』として使ったようです。
        </p>
        <p className="mt-3 font-mono text-sm leading-relaxed text-cyan-300">
          「かな入力を捨て、その指が叩く『文字』を信じろ。」
        </p>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          AUTH KEY (English Only)
        </label>
        <div className="flex items-center border-b-2 border-cyan-900 focus-within:border-cyan-400">
          <Icon
            name="arrow_forward_ios"
            className="mr-3 animate-pulse text-cyan-500"
          />
          <TextInput
            name="answer"
            inputMode="text"
            autoComplete="off"
            autoFocus
            placeholder="ENTER KEY..."
            required
            className="border-0 text-lg tracking-widest focus:ring-0"
          />
        </div>
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          AUTHENTICATE SYSTEM
        </GlowButton>
      </Form>

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
