import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useActionData } from "react-router";
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
    <PageShell sessionId="ID: X-99">
      <StageHeader title="STAGE 03" eyebrow="INDOOR PROBE">
        <p>掃き溜めに鶴……ごみの中にも素敵なものがあることを表す言葉です。</p>
      </StageHeader>

      <SystemPanel className="my-8 border-l-2 border-cyan-400 bg-cyan-950/10">
        <div className="mb-3 flex items-center gap-2 text-cyan-400">
          <Icon name="search" className="text-sm" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            PHASE_01 / KEYWORD
          </span>
        </div>
        <p className="text-sm leading-relaxed text-on-surface">
          佐藤さんはよく部屋の隅のゴミ箱にメモを捨てていました。確認してみてください。
        </p>
        <p className="mt-3 font-mono text-sm leading-relaxed text-cyan-300">
          探索結果のキーワードを入力してください。
        </p>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          KEYWORD (alphanumeric)
        </label>
        <div className="flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
          <span className="mr-2 font-mono text-cyan-500/60">&gt;</span>
          <TextInput
            name="answer"
            inputMode="text"
            autoComplete="off"
            autoFocus
            placeholder="AWAITING_INPUT..."
            required
            className="border-0 uppercase tracking-widest focus:ring-0"
          />
        </div>
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          EXECUTE_DECRYPT
        </GlowButton>
      </Form>

      <HintChat hint="STAGE 03 のキーワードはことわざ『掃き溜めに鶴』に由来します。会場のゴミ箱付近に隠されたメモを探し、ローマ字(ヘボン式・半角小文字)で入力してください。" />
    </PageShell>
  );
}
