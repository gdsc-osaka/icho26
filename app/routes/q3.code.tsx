import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useActionData } from "react-router";
import {
  ErrorAlert,
  GlowButton,
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
import { applyQ3Code } from "~/lib/participant/transitions";
import type { Route } from "./+types/q3.code";

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
  const correct = isCorrect("Q3_CODE", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ3Code(user, correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q3_CODE",
      rawInput: raw,
      normalizedInput: normalized,
      correct: correct ? 1 : 0,
      createdAt: now,
    },
    now,
  );

  if (correct) throw redirect("/q4");
  return {
    ok: false as const,
    message: "コード不一致。入力フォーマット(有効数字 3 桁)を確認してください。",
  };
}

export default function Q3Code() {
  const actionData = useActionData<typeof action>();
  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="Q3 — NUMERIC CODE">
          <p>アプリのさらなる上級権限を解放するには数字のコードが必要です。</p>
          <p className="mt-3 font-mono text-text-primary">
            有効数字 3 桁で入力してください(例: 1.23)。
          </p>
        </StageHeader>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <TextInput
          name="answer"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder="0.00"
          className="w-full"
          required
        />
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          SUBMIT
        </GlowButton>
      </Form>
    </main>
  );
}
