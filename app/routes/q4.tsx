import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useActionData } from "react-router";
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
import { findUserByGroupId } from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  requireParticipant,
} from "~/lib/participant/session";
import { applyQ4Answer } from "~/lib/participant/transitions";
import type { Route } from "./+types/q4";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const raw = String(formData.get("answer") ?? "");
  const normalized = normalize(raw);
  const correct = isCorrect("Q4", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ4Answer(user, correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q4",
      rawInput: raw,
      normalizedInput: normalized,
      correct: correct ? 1 : 0,
      createdAt: now,
    },
    now,
  );

  if (correct) throw redirect("/release");
  return {
    ok: false as const,
    message: "認証失敗。定数を再確認してください。",
  };
}

export default function Q4() {
  const actionData = useActionData<typeof action>();
  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="Q4 — CONSTANT AUTH">
          <p>
            アーテを解放するには私から接続するためにある定数を認証しないといけません!
          </p>
          <p className="mt-3 font-mono text-text-primary">
            定数を探してください。
          </p>
        </StageHeader>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <TextInput
          name="answer"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="CONSTANT"
          className="w-full"
          required
        />
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          AUTHENTICATE
        </GlowButton>
      </Form>

      <HintChat hint="STAGE 04 は『イリスのラッキーナンバー』が定数です。今日のイベント名や日付に強く結び付いた、二桁の数字を半角で入力してください。" />
    </main>
  );
}
