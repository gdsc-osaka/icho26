import { drizzle } from "drizzle-orm/d1";
import { useEffect, useState } from "react";
import { Form, redirect, useLoaderData, useRevalidator } from "react-router";
import * as schema from "../../db/schema";
import { Icon } from "~/components";
import { getReservationStatus } from "~/lib/operator/reservations";
import { applyTransition } from "~/lib/participant/mutations";
import { findUserByGroupId } from "~/lib/participant/queries";
import {
  getGroupIdFromRequest,
  setGroupIdCookie,
} from "~/lib/participant/session";
import { startOrResume } from "~/lib/participant/transitions";
import type { Q1Order } from "~/lib/participant/types";
import { createUser } from "~/lib/shared/users";
import type { Route } from "./+types/start.$groupId";

const GROUP_ID_PATTERN =
  /^g_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function pickQ1Order(): Q1Order {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! & 1) === 0 ? "Q1_1_FIRST" : "Q1_2_FIRST";
}

/**
 * QR からの初回アクセスではユーザーを作成しつつスタート画面を表示する。
 * ステージ遷移（START → Q1）は START ボタン押下時の action で行う。
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { groupId } = params;
  if (!groupId || !GROUP_ID_PATTERN.test(groupId)) {
    throw redirect("/");
  }

  const db = drizzle(env.DB);
  const existing = await findUserByGroupId(db, groupId);
  const now = new Date().toISOString();
  const user = existing ?? (await createUser(db, groupId, now));

  // すでに START を抜けている場合は途中再開のため、対応するルートへ送る。
  if (user.currentStage !== "START") {
    throw redirect(stageEntryPath(user.currentStage), {
      headers: { "Set-Cookie": setGroupIdCookie(groupId) },
    });
  }

  // 予約発行された行は admit されるまで待機画面を表示する。
  let reservation: LoaderReservation = null;
  if (user.reservedAt && !user.admittedAt) {
    const schemaDb = drizzle(env.DB, { schema });
    const status = await getReservationStatus(schemaDb, groupId, now);
    if (status.kind === "waiting") {
      reservation = {
        position: status.position,
        estimatedStartAt: status.estimatedStartAt,
        slotMinutes: status.slotMinutes,
      };
    }
  }

  const payload: LoaderData = {
    groupId,
    groupName: user.groupName ?? null,
    reservation,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setGroupIdCookie(groupId),
    },
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const cookieGroupId = getGroupIdFromRequest(request);
  if (!cookieGroupId) throw redirect("/");

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, cookieGroupId);
  if (!user) throw redirect("/");

  const now = new Date().toISOString();
  // 予約発行で待機中の場合は、運営が admit するまで再度待機画面に戻す。
  if (user.reservedAt && !user.admittedAt) {
    throw redirect(`/start/${cookieGroupId}`);
  }

  const transition = startOrResume(user, pickQ1Order(), now);
  if (transition.events.length > 0) {
    await applyTransition(db, transition.user, transition.events, null, now);
  }

  throw redirect(stageEntryPath(transition.user.currentStage));
}

function stageEntryPath(stage: string): string {
  switch (stage) {
    case "Q1":
      return "/q1";
    case "Q2":
      return "/q2";
    case "Q3_KEYWORD":
    case "Q3_CODE":
      return "/q3";
    case "Q4":
      return "/q4";
    case "FAKE_END":
      return "/release";
    case "COMPLETE":
      return "/complete";
    default:
      return "/q1";
  }
}

type LoaderReservation = {
  position: number;
  estimatedStartAt: string;
  slotMinutes: number;
} | null;

type LoaderData = {
  groupId: string;
  groupName: string | null;
  reservation: LoaderReservation;
};

const RESERVATION_POLL_MS = 5_000;

export default function StartGroup() {
  const { groupId, reservation } = useLoaderData<LoaderData>();
  const shortId = formatShortId(groupId);
  const localTime = useLocalClock();
  useReservationRevalidator(reservation !== null);

  return (
    <div className="start-root relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div className="start-noise pointer-events-none fixed inset-0 z-0" />
      <div className="start-bloom pointer-events-none fixed inset-0 z-0" />
      <CircuitBackdrop />

      {/* Top app bar */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-cyan-900/50 bg-[#05070A]/80 px-4 shadow-[0_4px_20px_rgba(0,240,255,0.1)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Icon name="fingerprint" className="text-cyan-400" />
          <span className="font-display text-xs font-bold uppercase tracking-tighter text-cyan-400 drop-shadow-[0_0_5px_#00F0FF]">
            IRIS_OS_v2.4
          </span>
        </div>
        <div className="font-display text-xs uppercase tracking-tighter text-cyan-400">
          ID: {shortId}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-8 pb-32 pt-24 text-center">
        <div className="start-avatar-pop">
          <IrisAvatar />
        </div>

        <div
          className="start-fade-up mb-8 space-y-2"
          style={{ animationDelay: "300ms" }}
        >
          <h1 className="font-display text-4xl uppercase tracking-[0.2em] text-primary drop-shadow-[0_0_10px_rgba(219,252,255,0.5)] md:text-5xl">
            IRIS SYSTEM REPAIR
          </h1>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
        </div>

        <div
          className="start-fade-up relative mb-12 max-w-2xl rounded-lg border border-outline-variant bg-surface-container/40 p-6 backdrop-blur-md"
          style={{ animationDelay: "600ms" }}
        >
          <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-cyan-400" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-cyan-400" />
          <p className="text-sm leading-relaxed tracking-wide text-on-surface-variant md:text-base">
            あなたはNexus
            Dynamicsの新人社員です。入社一ヶ月、突如会社が倒産しました。
            <br />
            公式の説明は一切なく、残ったのはノイズに埋もれた社内用AIツール「Iris」のみ。
            <br />
            あなたの任務はIrisのノイズを取り除き、真実を見つけることです。
          </p>
        </div>

        {reservation ? (
          <WaitingScreen reservation={reservation} />
        ) : (
          <Form
            method="post"
            className="start-fade-up flex flex-col items-center gap-6"
            style={{ animationDelay: "1000ms" }}
          >
            <button
              type="submit"
              className="group relative overflow-hidden border-2 border-cyan-400 bg-transparent px-16 py-4 text-cyan-400 transition-all duration-300 hover:bg-cyan-400/10 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-3">
                <Icon name="power_settings_new" className="text-2xl" />
                <span className="font-mono text-xl font-bold uppercase tracking-widest">
                  START
                </span>
              </span>
              <div className="absolute inset-0 bg-cyan-400 opacity-0 transition-opacity group-hover:opacity-5" />
            </button>
            <div className="flex items-center gap-8 opacity-50">
              <div className="flex items-center gap-2">
                <Icon
                  name="check_circle"
                  filled
                  className="text-xs text-cyan-400"
                />
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  Core Online
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="warning" className="text-xs text-cyan-300" />
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  Memory Fragmented
                </span>
              </div>
            </div>
          </Form>
        )}
      </main>

      {/* Bottom-left: System integrity */}
      <div className="pointer-events-none fixed bottom-8 left-8 z-30 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/60">
          System Integrity: 12%
        </span>
        <div className="flex h-1 w-32 bg-surface-container-highest">
          <div
            className="start-integrity-bar h-full bg-cyan-400 shadow-[0_0_5px_#00F0FF]"
            style={{ width: "12%" }}
          />
        </div>
      </div>

      {/* Bottom-right: Local time + system tag */}
      <div className="pointer-events-none fixed bottom-8 right-8 z-30 text-right">
        <span className="block font-mono text-[10px] uppercase tracking-widest text-cyan-400/60">
          Local Time: {localTime}
        </span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/40">
          ZEUS_CORP_OS_ENCRYPTED
        </span>
      </div>

      {/* Decorative gradient corners */}
      <div className="pointer-events-none fixed top-20 left-4 z-10 h-32 w-px bg-gradient-to-b from-cyan-400/40 to-transparent" />
      <div className="pointer-events-none fixed top-20 right-4 z-10 h-32 w-px bg-gradient-to-b from-cyan-400/40 to-transparent" />
      <div className="pointer-events-none fixed bottom-20 left-4 z-10 h-32 w-px bg-gradient-to-t from-cyan-400/40 to-transparent" />
      <div className="pointer-events-none fixed bottom-20 right-4 z-10 h-32 w-px bg-gradient-to-t from-cyan-400/40 to-transparent" />

      <style>{`
        .start-noise {
          opacity: 0.05;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='nf'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23nf)'/%3E%3C/svg%3E");
        }
        .start-bloom {
          background: radial-gradient(circle at 50% 50%, rgba(0,240,255,0.05) 0%, transparent 70%);
        }
        @keyframes start-scanline {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100vh); }
        }
        @keyframes start-fade-up {
          0%   { opacity: 0; transform: translateY(20px); filter: blur(6px); }
          100% { opacity: 1; transform: none;             filter: blur(0); }
        }
        @keyframes start-avatar-pop {
          0%   { opacity: 0; transform: scale(0.6) rotate(-12deg); filter: blur(8px); }
          60%  { opacity: 1; transform: scale(1.08) rotate(3deg);  filter: blur(0); }
          100% { opacity: 1; transform: scale(1) rotate(0);                          }
        }
        @keyframes start-integrity-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes start-core-pulse {
          0%, 100% { opacity: 1;   box-shadow: 0 0 20px #00F0FF; }
          50%      { opacity: 0.85; box-shadow: 0 0 40px #00F0FF, 0 0 70px rgba(0,240,255,0.4); }
        }
        .start-fade-up    { animation: start-fade-up 800ms cubic-bezier(0.22,1,0.36,1) both; }
        .start-avatar-pop { animation: start-avatar-pop 1100ms cubic-bezier(0.34,1.56,0.64,1) both; }
        .start-integrity-bar {
          transform-origin: left;
          animation: start-integrity-fill 1200ms cubic-bezier(0.22,1,0.36,1) 1500ms both;
        }
        .start-core-pulse { animation: start-core-pulse 2.4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .start-fade-up, .start-avatar-pop, .start-integrity-bar, .start-core-pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function IrisAvatar() {
  return (
    <div className="relative mb-12 flex h-48 w-48 items-center justify-center drop-shadow-[0_0_15px_rgba(0,240,255,0.6)]">
      {/* Outer dashed ring (rotating) */}
      <div className="absolute inset-0 animate-[spin_18s_linear_infinite] rounded-full border-2 border-dashed border-cyan-400/30" />
      {/* Hexagon wireframes (static, layered) */}
      <div className="absolute flex h-32 w-32 rotate-45 items-center justify-center border border-cyan-400/60">
        <div className="h-full w-full -rotate-12 border border-cyan-400/40" />
      </div>
      {/* Core */}
      <div className="start-core-pulse flex h-12 w-12 items-center justify-center rounded-sm bg-cyan-400">
        <Icon name="blur_on" className="text-3xl font-bold text-[#05070A]" />
      </div>
    </div>
  );
}

function CircuitBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-10"
      aria-hidden="true"
    >
      <svg
        className="h-full w-full text-cyan-400"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1000 1000"
      >
        <path
          d="M0 100 H200 V300 H400 V100 H600 V500 H1000"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <path
          d="M1000 900 H800 V700 H600 V900 H400 V500 H0"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <circle cx="200" cy="300" r="2" fill="currentColor" />
        <circle cx="600" cy="500" r="2" fill="currentColor" />
        <circle cx="400" cy="100" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}

function formatShortId(groupId: string): string {
  // groupId は "g_<uuid>" 形式。表示用に末尾 8 桁だけ切り出して大文字化。
  const tail = groupId.replace(/^g_/, "").replace(/-/g, "").slice(-8);
  return `IC-${tail.slice(0, 4).toUpperCase()}-${tail.slice(4).toUpperCase()}`;
}

function WaitingScreen({
  reservation,
}: {
  reservation: NonNullable<LoaderReservation>;
}) {
  const { position, estimatedStartAt, slotMinutes } = reservation;
  const startLabel = formatHHMM(estimatedStartAt);

  return (
    <div
      className="start-fade-up flex w-full max-w-xl flex-col items-center gap-6 rounded-lg border border-amber-400/40 bg-amber-950/20 p-6 backdrop-blur-md"
      style={{ animationDelay: "1000ms" }}
    >
      <div className="flex items-center gap-2 text-amber-300">
        <Icon name="hourglass_top" className="text-base" />
        <span className="font-mono text-[10px] uppercase tracking-[0.4em]">
          ADMISSION PENDING
        </span>
      </div>

      <div className="space-y-1 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200/60">
          Queue position
        </p>
        <p className="font-display text-5xl font-bold tabular-nums text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.4)]">
          {position}
          <span className="ml-2 align-top text-xl text-amber-200/70">番目</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 text-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200/60">
            予想開始時刻
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-amber-100">
            {startLabel}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-200/60">
            スロット長
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-amber-100">
            {slotMinutes}m
          </p>
        </div>
      </div>

      <p className="text-center font-mono text-xs leading-relaxed text-amber-100/70">
        運営から呼び出されるまで、しばらくお待ちください。
        <br />
        この画面は自動で更新されます。
      </p>
    </div>
  );
}

function useReservationRevalidator(active: boolean) {
  const revalidator = useRevalidator();
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(
      () => revalidator.revalidate(),
      RESERVATION_POLL_MS,
    );
    return () => window.clearInterval(id);
  }, [active, revalidator]);
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function useLocalClock(): string {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`,
      );
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}
