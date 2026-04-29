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
import { applyQ1Answer, unlockedSub } from "~/lib/participant/transitions";
import type { Route } from "./+types/q1.2";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  if (unlockedSub(user) !== "Q1_2") throw redirect("/q1");

  const db = drizzle(env.DB);
  const answered = await hasCorrectAttempt(db, user.groupId, "Q1_2");
  return { answered };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const raw = String(formData.get("answer") ?? "");
  const normalized = normalize(raw);
  const correct = isCorrect("Q1_2", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ1Answer(user, "Q1_2", correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q1_2",
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

export default function Q1_2() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const showCheckpointPrompt = data.answered || actionData?.ok === true;

  if (showCheckpointPrompt) {
    return (
      <main className="mx-auto max-w-md space-y-6 px-6 py-12">
        <SystemPanel>
          <StageHeader title="DECRYPTION 1-2 — UNLOCKED">
            <p>
              解答を受領しました。会場のチェックポイントに向かい、設置された QR
              をスキャンして物理認証を完了してください。
            </p>
          </StageHeader>
        </SystemPanel>
        <p className="text-center font-mono text-sm text-text-secondary">
          □ AWAITING PHYSICAL VERIFICATION
        </p>
        <Link
          to="/q1"
          className="block text-center font-mono text-xs text-accent underline"
        >
          BACK TO HUB
        </Link>
      </main>
    );
  }

  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="DECRYPTION 1-2">
          <p>パズルを解いて、求めた値を入力してください。</p>
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
        BACK TO HUB
      </Link>

      <HintChat />
    </main>
  );
}
