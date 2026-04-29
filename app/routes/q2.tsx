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
      <main className="mx-auto max-w-md space-y-6 px-6 py-12">
        <SystemPanel>
          <StageHeader title="Q2 — DECRYPTED">
            <p>
              解答を受領しました。会場のチェックポイントに向かい、設置された QR
              をスキャンして物理認証を完了してください。
            </p>
          </StageHeader>
        </SystemPanel>
        <p className="text-center font-mono text-sm text-text-secondary">
          □ AWAITING PHYSICAL VERIFICATION
        </p>
      </main>
    );
  }

  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="Q2 — KEY TRANSFORMER">
          <p>
            神のAI通称アーテは私の上位互換として、完成したら今の私に覆いかぶさるように、私とつなげて作られています。
          </p>
          <p className="mt-3">
            AI開発本部長の佐藤さんは倒産直前、認証キーを書き換えました。彼は、物理的なキーボードそのものを『変換機』として使ったようです。
          </p>
        </StageHeader>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <TextInput
          name="answer"
          inputMode="text"
          autoComplete="off"
          autoFocus
          placeholder="ANSWER"
          className="w-full"
          required
        />
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          SUBMIT
        </GlowButton>
      </Form>

      <Link
        to="/q1"
        className="block text-center font-mono text-xs text-text-secondary underline"
      >
        BACK
      </Link>

      <HintChat hint="STAGE 02 は『佐藤のメモ』に記された かな の並びを、キーボード上で同じ位置にある英数字に置き換える設問です。半角小文字で入力し、記号やスペースは含めないでください。" />
    </main>
  );
}
