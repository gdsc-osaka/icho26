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
import { FREQ_Q1_2_HZ } from "~/lib/dowsing/config";
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
      <PageShell sessionId="ID: X-99">
        <StageHeader title="DECRYPTION 1-2 — UNLOCKED" eyebrow="STATUS">
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

        <DowsingCard targetFreqHz={FREQ_Q1_2_HZ} label="DOWSING Q1-2" />

        <Link
          to="/q1"
          className="mt-4 inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-cyan-400"
        >
          <Icon name="arrow_back" className="text-sm" /> BACK TO HUB
        </Link>
      </PageShell>
    );
  }

  const errorMessage = actionData?.ok === false ? actionData.message : null;

  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="DECRYPTION 1-2" eyebrow="MODULE: AREA SCAN">
        <p>パズルを解いて、求めた値を入力してください。</p>
      </StageHeader>

      <SystemPanel className="my-8 text-center">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
          PATTERN MATCHING
        </p>
        <p className="font-mono leading-relaxed text-cyan-300/80">
          3×3 グリッドと予約状況を照合し、座標を特定してください。
        </p>
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          COORDINATE
        </label>
        <div className="flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
          <Icon
            name="arrow_forward_ios"
            className="mr-2 text-sm text-cyan-500"
          />
          <TextInput
            name="answer"
            inputMode="text"
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

      <HintChat hint="DECRYPTION 1-2 はパズルから読み取れる一桁の数値が答えです。配布資料に散らばったヒントを順に組み合わせてみてください。" />
    </PageShell>
  );
}
