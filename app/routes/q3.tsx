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
import { applyQ3Keyword } from "~/lib/participant/transitions";
import type { Route } from "./+types/q3";

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
  const correct = isCorrect("Q3_KEYWORD", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ3Keyword(user, correct, now);
  await applyTransition(
    db,
    transition.user,
    transition.events,
    {
      id: crypto.randomUUID(),
      groupId,
      stage: "Q3_KEYWORD",
      rawInput: raw,
      normalizedInput: normalized,
      correct: correct ? 1 : 0,
      createdAt: now,
    },
    now,
  );

  if (correct) throw redirect("/q3/code");
  return {
    ok: false as const,
    message: "認証失敗。入力値を再確認してください。",
  };
}

export default function Q3Keyword() {
  const actionData = useActionData<typeof action>();
  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel>
        <StageHeader title="Q3 — INDOOR PROBE">
          <p>
            掃き溜めに鶴……ごみの中にも素敵なものがあることを表す言葉です。
          </p>
          <p className="mt-3">
            佐藤さんはよく部屋の隅のゴミ箱にメモを捨てていました。確認してみてください。
          </p>
          <p className="mt-3 font-mono text-text-primary">
            探索結果のキーワードを入力してください。
          </p>
        </StageHeader>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <TextInput
          name="answer"
          inputMode="text"
          autoComplete="off"
          autoFocus
          placeholder="KEYWORD"
          className="w-full"
          required
        />
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          SUBMIT
        </GlowButton>
      </Form>

      <HintChat />
    </main>
  );
}
