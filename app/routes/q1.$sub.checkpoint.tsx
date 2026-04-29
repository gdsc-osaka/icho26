import { drizzle } from "drizzle-orm/d1";
import { Form, redirect, useLoaderData } from "react-router";
import {
  GlowButton,
  Icon,
  PageShell,
  StageHeader,
  SystemPanel,
} from "~/components";
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
  return (
    <PageShell sessionId="ID: X-99">
      <StageHeader title="CHECKPOINT VERIFICATION" eyebrow="PHYSICAL AUTH">
        <p>
          位置認証を行います。下のボタンを押してチェックポイントを完了してください。
        </p>
      </StageHeader>

      <div className="my-10 flex flex-col items-center gap-4">
        <Icon
          name="location_on"
          filled
          className="text-6xl text-cyan-400 drop-shadow-[0_0_20px_rgba(0,240,255,0.6)]"
        />
        <SystemPanel>
          <p className="text-center font-mono text-xs uppercase tracking-widest text-on-surface-variant">
            SUB-{data.sub.replace("Q1_", "")} / CODE
          </p>
          <p className="mt-1 text-center font-display text-xl tracking-[0.3em] text-cyan-400">
            {data.code}
          </p>
        </SystemPanel>
      </div>

      <Form method="post">
        <input type="hidden" name="code" value={data.code} />
        <GlowButton type="submit" className="w-full">
          VERIFY CHECKPOINT
        </GlowButton>
      </Form>
    </PageShell>
  );
}
