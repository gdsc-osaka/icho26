import { drizzle } from "drizzle-orm/d1";
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
  const data = useLoaderData<typeof loader>();
  const subNum = data.sub === "Q1_1" ? "1" : "2";
  const innerIcon = data.sub === "Q1_1" ? "looks_one" : "looks_two";

  return (
    <PageShell sessionId="ID: X-99">
      <div className="mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-['Space_Grotesk'] text-cyan-400 text-xs tracking-widest uppercase">
            AUTH_SUCCESS: [ Q1-{subNum} CLEARED ]
          </span>
        </div>
        <h2 className="text-primary text-2xl font-bold leading-tight">
          認証成功。
          <br />
          <span className="opacity-70 text-lg font-normal">
            ただし、物理キーの照合が必要です。
          </span>
        </h2>
      </div>

      <div className="flex flex-col items-center justify-center relative my-8">
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className="w-[300px] h-[300px] border border-cyan-500/20 rounded-full absolute" />
          <div className="absolute w-[400px] h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="absolute w-px h-[400px] bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
        </div>

        <div className="relative w-64 h-64 flex items-center justify-center bg-[#05070A]/40 backdrop-blur-md border border-cyan-500/20 rounded-full shadow-[inset_0_0_40px_rgba(0,240,255,0.1),0_0_20px_rgba(0,240,255,0.1)] overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <Icon
              name="nfc"
              className="text-cyan-400 animate-pulse"
              style={{ fontSize: "5rem" }}
            />
            <Icon
              name={innerIcon}
              className="mt-4 text-cyan-400/50"
              style={{ fontSize: "2rem" }}
            />
          </div>
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
              strokeDasharray="300"
              strokeDashoffset="100"
              strokeWidth="2"
              className="text-cyan-400"
            />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent" />
        </div>

        <div className="mt-8 text-center space-y-4 max-w-xs mx-auto">
          <p className="text-on-surface text-sm leading-relaxed">
            指定された場所のNFCタグに
            <br />
            デバイスをかざしてください。
          </p>
        </div>
      </div>

      <div
        className="bg-[#05070A]/40 backdrop-blur-md p-4"
        style={{
          border: "1px solid rgba(0,240,255,0.15)",
          borderLeft: "2px solid rgba(0,240,255,0.6)",
        }}
      >
        <div className="flex gap-3">
          <Icon name="info" className="text-cyan-400 text-lg shrink-0" />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            ※NFCが反応しない場合は、お近くの運営スタッフまでお声がけください。
          </p>
        </div>
      </div>

      <Form method="post" className="mt-6">
        <input type="hidden" name="code" value={data.code} />
        <GlowButton type="submit" className="w-full">
          LINK CONFIRMED → VERIFY
        </GlowButton>
      </Form>
    </PageShell>
  );
}
