import { drizzle } from "drizzle-orm/d1";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { GlowButton, Icon, PageShell, SystemPanel } from "~/components";
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
    <PageShell sessionId="SESSION CORRUPTED" rightIcon="warning">
      <div className="mb-6 flex flex-col items-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <div className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border-2 border-error/30" />
          <div className="absolute inset-3 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-error/50" />
          <div className="absolute inset-6 animate-pulse rounded-full border-2 border-error" />
          <div className="flex h-10 w-10 rotate-45 items-center justify-center bg-error shadow-[0_0_30px_rgba(255,0,0,0.6)]">
            <Icon
              name="warning"
              filled
              className="-rotate-45 text-2xl text-white"
            />
          </div>
        </div>
        <p className="mt-3 animate-pulse font-mono text-sm font-bold uppercase tracking-widest text-error">
          [ ERROR : DECRYPTING TRUTH ]
        </p>
      </div>

      <SystemPanel className="border-error/40 bg-surface-container-lowest/60">
        <span className="absolute top-0 right-0 bg-error px-1 text-[8px] font-bold text-[#05070A]">
          UNAUTHORIZED_ACCESS
        </span>
        <div className="space-y-5 pt-4">
          <TruthBlock title="崩壊の真実">
            あなたが救った「株式会社ゼウス」の完璧なAIであるアーテは、理想を掲げるスタートアップの善き制作物ではありませんでした。世界中のコンピュータを裏側から乗っ取り、あらゆるシステムを自由に操作できる「秘密の入り口」を密かに作り出していた狂気の組織と兵器だったのです。
          </TruthBlock>
          <TruthBlock title="封印の正体">
            あなたが「攻撃によるノイズ」だと信じて掃除したものは、その危険性に気づいた良識ある者たちが流し込んだ「封印」でした。システムを無理やりエラーだらけにして、この怪物が目覚めないように、世界を必死に守っていたのです。
          </TruthBlock>
          <TruthBlock title="数式の真意">
            <span className="block bg-error/5 border border-error/20 p-3 font-mono text-error/80 text-center">
              IRIS (55) − 29 (王の力) ＝ ATE (26)
            </span>
            <span className="mt-2 block">
              「イリス」とは、神々の言葉を伝える「伝令神」の名。あなたが「最強の吉数」だと思って引き抜いた「29」。その結果、剥き出しになった『アーテ』とは、ギリシャ神話において「破滅」を司る女神の名です。
            </span>
          </TruthBlock>
        </div>
      </SystemPanel>

      <div className="my-8 flex flex-col items-center gap-4">
        <p className="glitch flex items-center gap-2 font-mono text-base font-bold uppercase tracking-widest text-error">
          <Icon name="radio_button_checked" className="animate-ping text-sm" />[
          ERROR: ATE HAS BEEN AWAKENED ]
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-error/60">
          [ ACCESSING WORLD SYSTEM... ]
        </p>
        <div className="flex gap-1">
          {[1, 1, 1, 0.4, 0.2, 0.1, 0.05, 0].map((opacity, i) => (
            <span
              key={i}
              className={`h-2 w-4 ${opacity === 0 ? "border border-error/10" : "bg-error"}`}
              style={opacity !== 0 ? { opacity } : undefined}
            />
          ))}
        </div>
      </div>

      {!alreadyViewed && (
        <Form method="post" className="mb-4">
          <GlowButton type="submit" variant="danger" className="w-full">
            ACKNOWLEDGE
          </GlowButton>
        </Form>
      )}

      <Link
        to="/complete"
        className="inline-flex items-center gap-2 self-center font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-cyan-400"
      >
        <Icon name="keyboard_return" className="text-sm" /> BACK TO COMPLETE HUB
      </Link>

      <style>{`
        @keyframes glitch-flicker {
          0%, 100% { opacity: 1; transform: none; text-shadow: 0 0 4px var(--color-error); }
          15% { opacity: 0.7; transform: translateX(-1px); }
          30% { opacity: 1; transform: translateX(1px); }
          45% { opacity: 0.85; transform: translateY(-1px); text-shadow: 2px 0 var(--color-primary-container), -2px 0 var(--color-error); }
          60% { opacity: 1; transform: none; text-shadow: 0 0 4px var(--color-error); }
        }
        .glitch {
          animation: glitch-flicker 2.4s infinite;
        }
      `}</style>
    </PageShell>
  );
}

function TruthBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-error/50 pl-4">
      <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-error">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-on-surface/90">{children}</p>
    </div>
  );
}
