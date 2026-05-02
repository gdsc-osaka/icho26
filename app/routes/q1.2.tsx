import { drizzle } from "drizzle-orm/d1";
import { useTranslation } from "react-i18next";
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
  const rawRow = String(formData.get("row") ?? "");
  const rawCol = String(formData.get("col") ?? "");
  const raw = `${rawRow},${rawCol}`;
  // 行と列をそれぞれ正規化してから連結することで、全角カンマ等の表記揺れを回避する
  const normalized = `${normalize(rawRow)},${normalize(rawCol)}`;
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
        messageKey: "errors.authFailed",
      } as const);
}

export default function Q1_2() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const showCheckpointPrompt = data.answered || actionData?.ok === true;

  if (showCheckpointPrompt) {
    return (
      <PageShell sessionId="ID: X-99">
        <StageHeader title="DECRYPTION 1-2 — UNLOCKED" eyebrow="STATUS">
          <p>{t("q1_2.checkpointInstruction")}</p>
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

  const errorMessage =
    actionData?.ok === false ? t(actionData.messageKey) : null;

  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="DECRYPTION 1-2" eyebrow={t("q1_2.moduleLabel")}>
        <p>{t("q1_2.instruction")}</p>
      </StageHeader>

      <SystemPanel className="my-6">
        <div className="flex items-start gap-3">
          <Icon
            name="terminal"
            className="mt-0.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(0,240,255,0.5)]"
          />
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              [MESSAGE_INCOMING]
            </p>
            <p className="font-mono text-sm leading-relaxed text-on-surface">
              {t("q1_2.messageBody")}
            </p>
          </div>
        </div>
      </SystemPanel>

      <SystemPanel className="my-6">
        <img
          src="/q1-2-pattern.png"
          alt="LOCAL_SCAN_PATTERN_BETA: 3x3 grid showing reserved and empty seats with a target '?' cell"
          className="mx-auto block w-full max-w-sm"
        />
      </SystemPanel>

      <Form method="post" className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          TARGET COORDINATE
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="q1-2-row"
              className="block font-mono text-[10px] uppercase tracking-widest text-cyan-500/70"
            >
              {t("q1_2.rowLabel")}
            </label>
            <div className="mt-1 flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
              <Icon name="table_rows" className="mr-2 text-sm text-cyan-500" />
              <TextInput
                id="q1-2-row"
                name="row"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="0"
                required
                className="border-0 focus:ring-0"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="q1-2-col"
              className="block font-mono text-[10px] uppercase tracking-widest text-cyan-500/70"
            >
              {t("q1_2.colLabel")}
            </label>
            <div className="mt-1 flex items-center border-b border-cyan-900 focus-within:border-cyan-400">
              <Icon name="view_column" className="mr-2 text-sm text-cyan-500" />
              <TextInput
                id="q1-2-col"
                name="col"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                required
                className="border-0 focus:ring-0"
              />
            </div>
          </div>
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

      <HintChat hint={t("q1_2.hint")} />
    </PageShell>
  );
}
