import { drizzle } from "drizzle-orm/d1";
import { useTranslation } from "react-i18next";
import { Form, redirect, useLoaderData } from "react-router";
import { GlowButton, Icon, PageShell } from "~/components";
import { applyTransition } from "~/lib/participant/mutations";
import {
  findUserByGroupId,
  getCheckpointCode,
  hasCorrectAttempt,
} from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  requireParticipant,
} from "~/lib/participant/session";
import { applyQ1Checkpoint, unlockedSub } from "~/lib/participant/transitions";
import type { SubQuestion } from "~/lib/participant/types";
import type { Route } from "./+types/q1.$sub.checkpoint";

function paramToSub(raw: string | undefined): SubQuestion | null {
  if (raw === "1") return "Q1_1";
  if (raw === "2") return "Q1_2";
  return null;
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const sub = paramToSub(params.sub);
  if (!sub) throw redirect("/q1");

  const { user } = await requireParticipant(request, env);
  if (unlockedSub(user) !== sub) throw redirect("/q1");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) throw redirect("/q1");

  const db = drizzle(env.DB);
  const cp = await getCheckpointCode(db, code);
  if (!cp || cp.stage !== sub) throw redirect("/q1");

  return { code, sub };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const sub = paramToSub(params.sub);
  if (!sub) throw redirect("/q1");

  const formData = await request.formData();
  const code = String(formData.get("code") ?? "");

  const db = drizzle(env.DB);
  const cp = await getCheckpointCode(db, code);
  if (!cp || cp.stage !== sub) throw redirect("/q1");

  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const answered = await hasCorrectAttempt(db, groupId, sub);

  const now = new Date().toISOString();
  let nextStage: string;
  try {
    const transition = applyQ1Checkpoint(user, sub, answered, now);
    await applyTransition(db, transition.user, transition.events, null, now);
    nextStage = transition.user.currentStage;
  } catch {
    throw redirect(`/q1/${params.sub}`);
  }

  throw redirect(nextStage === "Q2" ? "/q2" : "/q1");
}

export default function Q1Checkpoint() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const subNum = data.sub === "Q1_1" ? "1" : "2";
  const innerIcon = data.sub === "Q1_1" ? "looks_one" : "looks_two";

  return (
    <PageShell sessionId="ID: X-99">
      <div className="mb-6 space-y-2 animate-verify-fade-up">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-cyan-400" />
          </span>
          <span className="font-['Space_Grotesk'] text-cyan-400 text-xs tracking-widest uppercase text-glow-cyan">
            NFC_LINK: [ Q1-{subNum} VERIFIED ]
          </span>
        </div>
        <h2 className="text-primary text-2xl font-bold leading-tight">
          {t("q1Checkpoint.verifiedHeading")}
          <br />
          <span className="opacity-70 text-lg font-normal">
            {t("q1Checkpoint.verifiedSub")}
          </span>
        </h2>
      </div>

      <div className="flex flex-col items-center justify-center relative my-8">
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-[300px] h-[300px] border border-cyan-500/20 rounded-full absolute animate-verify-ring-reverse" />
          <div className="absolute w-[400px] h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="absolute w-px h-[400px] bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
        </div>

        <div
          className="absolute w-64 h-64 rounded-full border border-cyan-400/40 animate-verify-pulse-ring pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute w-64 h-64 rounded-full border border-cyan-400/30 animate-verify-pulse-ring pointer-events-none"
          style={{ animationDelay: "1.3s" }}
          aria-hidden="true"
        />

        <div className="relative w-64 h-64 flex items-center justify-center bg-[#05070A]/40 backdrop-blur-md border border-cyan-500/30 rounded-full overflow-hidden animate-verify-glow-breath">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-verify-scan-sweep" />
          </div>

          <svg
            className="absolute inset-0 w-full h-full animate-verify-ring"
            aria-hidden="true"
          >
            <circle
              cx="50%"
              cy="50%"
              fill="transparent"
              r="46%"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 8"
              className="text-cyan-400/40"
            />
          </svg>
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50%"
              cy="50%"
              fill="transparent"
              r="48%"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan-500/10"
            />
            <circle
              cx="50%"
              cy="50%"
              fill="transparent"
              r="48%"
              stroke="currentColor"
              strokeDasharray="754"
              strokeDashoffset="0"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-cyan-400 iris-glow"
            />
          </svg>

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              <Icon
                name="verified"
                className="text-cyan-300 iris-glow"
                style={{ fontSize: "5rem" }}
              />
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 80 80"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M24 42 L36 54 L58 30"
                  stroke="rgba(0, 240, 255, 0.9)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-verify-checkmark"
                />
              </svg>
            </div>
            <Icon
              name={innerIcon}
              className="mt-3 text-cyan-400/60"
              style={{ fontSize: "1.75rem" }}
            />
          </div>

          <div className="absolute inset-0 pointer-events-none">
            {[
              { left: "20%", top: "30%", vx: "10px", vy: "-50px", delay: "0s" },
              {
                left: "75%",
                top: "40%",
                vx: "-15px",
                vy: "-60px",
                delay: "0.6s",
              },
              {
                left: "30%",
                top: "70%",
                vx: "20px",
                vy: "-45px",
                delay: "1.2s",
              },
              {
                left: "65%",
                top: "65%",
                vx: "-10px",
                vy: "-55px",
                delay: "1.8s",
              },
              {
                left: "50%",
                top: "80%",
                vx: "5px",
                vy: "-65px",
                delay: "2.2s",
              },
            ].map((p, i) => (
              <span
                key={i}
                className="absolute w-1 h-1 rounded-full bg-cyan-300 animate-verify-particle"
                style={{
                  left: p.left,
                  top: p.top,
                  ["--vx" as string]: p.vx,
                  ["--vy" as string]: p.vy,
                  animationDelay: p.delay,
                  boxShadow: "0 0 6px rgba(0, 240, 255, 0.8)",
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        </div>

        <div
          className="mt-8 text-center space-y-4 max-w-xs mx-auto animate-verify-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <p className="whitespace-pre-line text-on-surface text-sm leading-relaxed">
            {t("q1Checkpoint.nfcSuccessBody")}
          </p>
        </div>
      </div>

      <Form
        method="post"
        className="mt-6 animate-verify-fade-up"
        style={{ animationDelay: "0.4s" }}
      >
        <input type="hidden" name="code" value={data.code} />
        <GlowButton type="submit" className="w-full">
          LINK CONFIRMED → VERIFY
        </GlowButton>
      </Form>
    </PageShell>
  );
}
