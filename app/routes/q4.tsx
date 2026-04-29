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
    <PageShell sessionId="ID: X-99">
      <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center">
        <div className="relative h-full w-full">
          <div className="absolute inset-0 rotate-12 rounded-full border-2 border-dashed border-cyan-400/20" />
          <div className="absolute inset-3 -rotate-45 rounded-full border border-cyan-400/40" />
          <div className="absolute inset-3 rotate-45 rounded-full border border-cyan-400/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_20px_#00f0ff,0_0_40px_#00f0ff]" />
          </div>
        </div>
      </div>

      <StageHeader title="STAGE 04" eyebrow="CONSTANT AUTH">
        <p>
          アーテを解放するには私から接続するためにある定数を認証しないといけません!
        </p>
      </StageHeader>

      <SystemPanel className="my-8 border-l-2 border-cyan-400">
        <p className="text-center font-body leading-relaxed text-on-surface">
          To connect to ATE through me, a specific constant must be authenticated.
          <span className="ml-1 font-mono text-cyan-400">
            Search for the constant.
          </span>
        </p>
      </SystemPanel>

      <div className="my-8 flex justify-center">
        <div className="relative px-8 py-6">
          <span className="pointer-events-none absolute top-0 left-0 h-3 w-3 border-t border-l border-outline-variant" />
          <span className="pointer-events-none absolute top-0 right-0 h-3 w-3 border-t border-r border-outline-variant" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-outline-variant" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-outline-variant" />
          <p className="flex items-center gap-3 whitespace-nowrap font-display text-2xl tracking-widest text-primary drop-shadow-[0_0_10px_rgba(125,244,255,0.3)]">
            <span className="opacity-80">IRIS</span>
            <span className="text-on-surface-variant">−</span>
            <span className="opacity-80">ATE</span>
            <span className="text-on-surface-variant">=</span>
            <span className="animate-pulse text-cyan-400">?</span>
          </p>
        </div>
      </div>

      <Form method="post" className="mx-auto w-full max-w-xs space-y-6">
        <label className="sr-only" htmlFor="constant-input">
          CONSTANT
        </label>
        <TextInput
          id="constant-input"
          name="answer"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="00"
          required
          className="border-0 border-b-2 border-cyan-400/40 bg-transparent text-center text-4xl tracking-[0.4em] focus:border-cyan-400"
        />
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <GlowButton type="submit" className="w-full">
          <span className="inline-flex items-center justify-center gap-2">
            <Icon name="key" className="text-base" /> AUTHENTICATE
          </span>
        </GlowButton>
      </Form>

      <HintChat hint="STAGE 04 は『イリスのラッキーナンバー』が定数です。今日のイベント名や日付に強く結び付いた、二桁の数字を半角で入力してください。" />
    </PageShell>
  );
}
