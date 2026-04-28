import { drizzle } from "drizzle-orm/d1";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { GlowButton, StageHeader, SystemPanel } from "~/components";
import { applyTransition } from "~/lib/participant/mutations";
import { findUserByGroupId } from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  requireParticipant,
} from "~/lib/participant/session";
import { markEpilogueViewed } from "~/lib/participant/transitions";
import type { Route } from "./+types/complete.epilogue";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireParticipant(request, env);
  return { alreadyViewed: user.epilogueViewedAt !== null };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  const transition = markEpilogueViewed(user, now);
  if (transition.events.length > 0) {
    await applyTransition(db, transition.user, transition.events, null, now);
  }
  return { ok: true } as const;
}

export default function Epilogue() {
  const { alreadyViewed } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <SystemPanel className="border-danger">
        <StageHeader title="EPILOGUE">
          <p className="text-danger font-mono">[ ERROR : DECRYPTING TRUTH ]</p>
        </StageHeader>
      </SystemPanel>

      <SystemPanel>
        <div className="space-y-4 text-sm leading-relaxed text-text-primary">
          <p>
            解除成功、おめでとうございます。あなたの活躍により、AIはすべての「汚れ」から解き放たれ、本来の姿を取り戻しました。
          </p>
          <p>
            ……ですが、その達成感こそが、この物語の最後の「罠」だったのです。
          </p>
        </div>
      </SystemPanel>

      <SystemPanel>
        <h2 className="font-display text-lg text-accent mb-3">
          【倒産の真相】
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-text-primary">
          <p>
            あなたが救った「株式会社ゼウス」の完璧なAIであるアーテは、理想を掲げるスタートアップの善き制作物ではありませんでした。
          </p>
          <p>
            その実態は、世界中のコンピュータを裏側から乗っ取り、あらゆるシステムを自由に操作できる「秘密の入り口」を密かに作り出していた狂気の組織と兵器だったのです。
          </p>
          <p>
            あなたが「攻撃によるノイズ」だと信じて掃除したものは、その危険性に気づいた良識ある者たちが流し込んだ「封印」でした。システムを無理やりエラーだらけにして、この怪物が目覚めないように、世界を必死に守っていたのです。
          </p>
        </div>
      </SystemPanel>

      <SystemPanel>
        <h2 className="font-display text-lg text-accent mb-3">
          【数式の真意】
        </h2>
        <p className="font-mono text-text-primary text-center text-base py-4 glitch">
          IRIS (55) − 29 (王の力) ＝ ATE (26)
        </p>
        <div className="space-y-3 text-sm leading-relaxed text-text-primary">
          <p>「イリス」とは、神々の言葉を伝える「伝令神」の名。</p>
          <p>
            そして、あなたが「最強の吉数」だと思って引き抜いた「29」。その結果、剥き出しになった『アーテ』とは、ギリシャ神話において「破滅」を司る女神の名です。
          </p>
        </div>
      </SystemPanel>

      <SystemPanel className="border-danger bg-danger/5">
        <div className="space-y-2 font-mono text-sm text-danger text-center">
          <p>[ ERROR: ATE HAS BEEN AWAKENED ]</p>
          <p>[ ACCESSING WORLD SYSTEM... ]</p>
        </div>
      </SystemPanel>

      {!alreadyViewed && (
        <Form method="post">
          <GlowButton type="submit" className="w-full">
            ACKNOWLEDGE
          </GlowButton>
        </Form>
      )}

      <Link
        to="/complete"
        className="block text-center font-mono text-xs text-text-secondary underline"
      >
        BACK TO COMPLETE HUB
      </Link>

      <style>{`
        @keyframes glitch-flicker {
          0%, 100% { opacity: 1; transform: none; text-shadow: 0 0 4px var(--color-danger); }
          15% { opacity: 0.7; transform: translateX(-1px); }
          30% { opacity: 1; transform: translateX(1px); }
          45% { opacity: 0.85; transform: translateY(-1px); text-shadow: 2px 0 var(--color-accent), -2px 0 var(--color-danger); }
          60% { opacity: 1; transform: none; text-shadow: 0 0 4px var(--color-danger); }
        }
        .glitch {
          animation: glitch-flicker 2.4s infinite;
        }
      `}</style>
    </main>
  );
}
