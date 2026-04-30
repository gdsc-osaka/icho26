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
      <div className="mb-6 space-y-2 animate-verify-fade-up">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-cyan-400" />
          </span>
          <span className="font-['Space_Grotesk'] text-cyan-400 text-xs tracking-widest uppercase text-glow-cyan">
            NFC_LINK: [ COFFEECUP VERIFIED ]
          </span>
        </div>
        <h2 className="text-primary text-2xl font-bold leading-tight">
          物理キー照合完了。
          <br />
          <span className="opacity-70 text-lg font-normal">
            次の認証フェーズへ進んでください。
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

        <div className="relative w-64 h-64 flex items-center justify-center bg-[#05070A]/40 backdrop-blur-md border border-cyan-500/40 rounded-full overflow-hidden animate-verify-glow-breath">
          <span className="absolute top-[-1px] left-[-1px] w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
          <span className="absolute top-[-1px] right-[-1px] w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          <span className="absolute bottom-[-1px] left-[-1px] w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
          <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-verify-scan-sweep" />
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
              name="coffee"
              className="mt-3 text-cyan-400/60"
              style={{ fontSize: "1.75rem" }}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        </div>

        <div
          className="mt-10 text-center space-y-4 max-w-xs mx-auto animate-verify-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <p className="text-on-surface text-sm leading-relaxed">
            佐藤さんのコーヒーカップとの
            <br />
            NFCリンクを確立しました。
          </p>

          <div className="space-y-2">
            <div className="flex justify-between font-['Space_Grotesk'] text-[10px] text-cyan-400/70 tracking-widest uppercase">
              <span className="animate-scan-progress-pulse">
                LINK VERIFIED — TRANSMITTING...
              </span>
              <span>100%</span>
            </div>
            <div className="relative h-1.5 w-full bg-slate-900 border border-cyan-500/20 overflow-hidden">
              <div className="absolute inset-0 flex gap-0.5 p-0.5">
                {[0, 0.15, 0.3, 0.45, 0.6, 0.75].map((delay) => (
                  <div
                    key={delay}
                    className="h-full w-1/6 bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-scan-segment-flicker"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
              <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 animate-scan-progress-full" />
            </div>
          </div>
        </div>
      </div>

      <div
        className="bg-[#05070A]/40 backdrop-blur-md p-4 animate-verify-fade-up"
        style={{
          animationDelay: "0.4s",
          border: "1px solid rgba(0,240,255,0.15)",
          borderLeft: "2px solid rgba(0,240,255,0.6)",
        }}
      >
        <div className="flex gap-3">
          <Icon name="check_circle" className="text-cyan-400 text-lg shrink-0" />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            物理キーの転送が完了しました。続けて次のフェーズへ進んでください。
          </p>
        </div>
      </div>

      <Form
        method="post"
        className="mt-6 animate-verify-fade-up"
        style={{ animationDelay: "0.5s" }}
      >
        <input type="hidden" name="code" value={data.code} />
        <GlowButton type="submit" className="w-full">
          LINK CONFIRMED → VERIFY
        </GlowButton>
      </Form>
    </PageShell>
  );
}
