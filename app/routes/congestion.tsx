import { drizzle } from "drizzle-orm/d1";
import { useEffect } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { Icon, PageShell, SystemPanel } from "~/components";
import {
  CONGESTION_CAPACITY,
  buildCongestionSnapshot,
  countActiveParticipants,
} from "~/lib/congestion";
import type { Route } from "./+types/congestion";

const POLL_MS = 5_000;

export function meta() {
  return [
    { title: "CONGESTION / icho26" },
    {
      name: "description",
      content: "Current congestion (active group participants / max capacity)",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const active = await countActiveParticipants(db);
  return buildCongestionSnapshot(active, CONGESTION_CAPACITY);
}

type Level = "low" | "mid" | "high";

function levelOf(pct: number): Level {
  if (pct < 50) return "low";
  if (pct < 85) return "mid";
  return "high";
}

const LEVEL_LABEL: Record<Level, string> = {
  low: "LOW",
  mid: "MODERATE",
  high: "HIGH",
};

const LEVEL_TEXT: Record<Level, string> = {
  low: "text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]",
  mid: "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.45)]",
  high: "text-rose-400 drop-shadow-[0_0_8px_rgba(255,77,77,0.5)]",
};

const LEVEL_BAR: Record<Level, string> = {
  low: "bg-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.55)]",
  mid: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]",
  high: "bg-rose-400 shadow-[0_0_12px_rgba(255,77,77,0.6)]",
};

const LEVEL_ACCENT: Record<Level, string> = {
  low: "border-cyan-500/40 bg-cyan-950/30 text-cyan-400",
  mid: "border-amber-500/40 bg-amber-950/30 text-amber-300",
  high: "border-rose-500/40 bg-rose-950/30 text-rose-400",
};

export default function CongestionPage() {
  const snap = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  useEffect(() => {
    const id = setInterval(() => revalidator.revalidate(), POLL_MS);
    return () => clearInterval(id);
  }, [revalidator]);

  const pct = Math.round(snap.rate * 100);
  const level = levelOf(pct);

  return (
    <PageShell sessionId="ID: CONGESTION" rightIcon="groups">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
        <div className="space-y-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-cyan-500/60">
            VENUE OCCUPANCY MONITOR
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)] md:text-4xl">
            CONGESTION RATE
          </h1>
          <div className="mx-auto h-px w-24 bg-cyan-500/50" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span
            className={`font-display text-7xl font-bold leading-none tracking-tight md:text-8xl ${LEVEL_TEXT[level]}`}
          >
            {pct}
            <span className="ml-1 align-top text-3xl md:text-4xl">%</span>
          </span>
          <div
            className={`inline-flex items-center gap-2 border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${LEVEL_ACCENT[level]}`}
          >
            <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
            {LEVEL_LABEL[level]}
          </div>
        </div>

        <SystemPanel className="w-full">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-cyan-500/70">
              <span>ACTIVE</span>
              <span>CAPACITY</span>
            </div>
            <div className="flex items-baseline justify-between font-display text-2xl text-on-surface">
              <span className="tabular-nums text-cyan-300">
                {snap.activeParticipants}
              </span>
              <span className="tabular-nums text-cyan-500/70">
                / {snap.capacity}
              </span>
            </div>
            <div
              className="relative h-3 overflow-hidden border border-cyan-900/50 bg-[#05070A]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={snap.capacity}
              aria-valuenow={Math.min(snap.activeParticipants, snap.capacity)}
              aria-label="Congestion gauge"
            >
              <div
                className={`h-full transition-[width] duration-700 ease-out ${LEVEL_BAR[level]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </SystemPanel>

        {snap.overCapacity && (
          <div
            className="flex items-center gap-2 border border-rose-500/60 bg-rose-950/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-rose-400"
            role="alert"
          >
            <Icon name="warning" className="text-[14px]" />
            <span>
              OVER CAPACITY — {snap.activeParticipants - snap.capacity} OVER
              LIMIT
            </span>
          </div>
        )}

        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-700">
          AUTO-REFRESH · {POLL_MS / 1000}s
        </p>
      </div>
    </PageShell>
  );
}
