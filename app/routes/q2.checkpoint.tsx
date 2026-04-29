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
import { applyQ2Checkpoint } from "~/lib/participant/transitions";
import type { Route } from "./+types/q2.checkpoint";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  await requireParticipant(request, env);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) throw redirect("/q2");

  const db = drizzle(env.DB);
  const cp = await getCheckpointCode(db, code);
  if (!cp || cp.stage !== "Q2") throw redirect("/q2");

  return { code };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const code = String(formData.get("code") ?? "");

  const db = drizzle(env.DB);
  const cp = await getCheckpointCode(db, code);
  if (!cp || cp.stage !== "Q2") throw redirect("/q2");

  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const answered = await hasCorrectAttempt(db, groupId, "Q2");

  const now = new Date().toISOString();
  try {
    const transition = applyQ2Checkpoint(user, answered, now);
    await applyTransition(db, transition.user, transition.events, null, now);
  } catch {
    throw redirect("/q2");
  }

  throw redirect("/q3");
}

export default function Q2Checkpoint() {
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
            STAGE 02 / CODE
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
