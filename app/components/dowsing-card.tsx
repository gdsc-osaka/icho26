import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CIRCLE_SHAKE_COEF,
  CIRCLE_SHAKE_MAX_PX,
  CIRCLE_SIZE_COEF,
  CIRCLE_SIZE_MAX_PX,
  CIRCLE_SIZE_MIN_PX,
  clamp,
} from "~/lib/dowsing/config";
import { useBeep } from "~/lib/dowsing/use-beep";
import { useHaptic } from "~/lib/dowsing/use-haptic";
import { useProximity } from "~/lib/dowsing/use-proximity";
import { DowsingTimeChart } from "./dowsing-time-chart";
import { Icon } from "./icon";
import { SystemPanel } from "./system-panel";

type Props = {
  /** 評価対象の中心周波数（Hz）。ルートごとに静的に渡す */
  targetFreqHz: number;
  /** 表示ラベル（Q1-1 / Q1-2 等） */
  label?: string;
};

/**
 * AR 信号探知（ダウジング）カード。
 * 解答送信後の AWAITING PHYSICAL VERIFICATION 表示と並べて配置する想定。
 */
export function DowsingCard({ targetFreqHz, label = "DOWSING" }: Props) {
  const { t } = useTranslation();
  const {
    state,
    dynamicProximity,
    errorReason,
    start,
    stop,
    getHistory,
    historyCapacity,
  } = useProximity(targetFreqHz);
  const isActive = state === "active";
  // 端末個体差を吸収するため、感度演出はすべて履歴 min..max 比の dynamicProximity を採用
  useHaptic(isActive, dynamicProximity);
  useBeep(isActive, dynamicProximity);

  const freqLabel = useMemo(
    () => `${(targetFreqHz / 1000).toFixed(1)} kHz`,
    [targetFreqHz],
  );

  return (
    <SystemPanel className="my-6">
      <header className="mb-4 flex items-end justify-between border-l-2 border-cyan-400 pl-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
            STATUS
          </p>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-cyan-400 drop-shadow-[0_0_6px_rgba(0,240,255,0.4)]">
            {label}
            {" / "}
            {state === "idle"
              ? "STANDBY"
              : state === "requesting"
                ? "INITIALIZING..."
                : state === "active"
                  ? "DETECTION ACTIVE"
                  : "UNAVAILABLE"}
          </h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
            FREQ
          </p>
          <p className="font-mono text-sm font-bold text-cyan-400">
            {freqLabel}
          </p>
        </div>
      </header>

      {state === "unavailable" ? (
        <UnavailableBody errorReason={errorReason} />
      ) : (
        <>
          <Radar proximity={isActive ? dynamicProximity : 0} />
          {isActive && (
            <SignalTimeline
              getHistory={getHistory}
              historyCapacity={historyCapacity}
              active={isActive}
            />
          )}

          <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-wider text-cyan-500/70">
            {isActive ? t("dowsing.activeGuidance") : t("dowsing.idleGuidance")}
          </p>

          <div className="mt-4">
            {state === "idle" && (
              <button
                type="button"
                onClick={start}
                className="group relative w-full overflow-hidden border border-cyan-400 bg-transparent py-3 font-mono text-sm font-bold uppercase tracking-[0.3em] text-cyan-400 transition-all hover:bg-cyan-500/10 active:scale-[0.98]"
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  <Icon name="radar" filled className="text-base" />
                  START DOWSING
                </span>
              </button>
            )}
            {state === "requesting" && (
              <p className="text-center font-mono text-xs uppercase tracking-widest text-cyan-400">
                <span className="animate-pulse">CALIBRATING NOISE FLOOR…</span>
              </p>
            )}
            {state === "active" && (
              <button
                type="button"
                onClick={stop}
                className="w-full border border-cyan-900/60 bg-transparent py-3 font-mono text-sm uppercase tracking-[0.3em] text-on-surface-variant transition-all hover:border-cyan-400 hover:text-cyan-400"
              >
                STOP
              </button>
            )}
          </div>
        </>
      )}
    </SystemPanel>
  );
}

function Radar({ proximity }: { proximity: number }) {
  const p = clamp(proximity, 0, 100) / 100;

  const size =
    CIRCLE_SIZE_MIN_PX +
    (CIRCLE_SIZE_MAX_PX - CIRCLE_SIZE_MIN_PX) * p * CIRCLE_SIZE_COEF;
  const shake = CIRCLE_SHAKE_MAX_PX * p * CIRCLE_SHAKE_COEF;

  const coreRef = useRef<HTMLDivElement | null>(null);
  const shakeRef = useRef(shake);

  useEffect(() => {
    shakeRef.current = shake;
  }, [shake]);

  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      const node = coreRef.current;
      const s = shakeRef.current;
      if (node) {
        const x = s === 0 ? 0 : (Math.random() * 2 - 1) * s;
        const y = s === 0 ? 0 : (Math.random() * 2 - 1) * s;
        node.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center">
      <span className="pointer-events-none absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-cyan-400" />
      <span className="pointer-events-none absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-cyan-400" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-cyan-400" />

      <div className="absolute inset-4 animate-[spin_12s_linear_infinite] rounded-full border border-cyan-500/15" />
      <div className="absolute inset-10 animate-[spin_8s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-400/25" />

      <div
        ref={coreRef}
        className="rounded-full border-2 border-cyan-400 bg-cyan-500/5 shadow-[0_0_25px_rgba(0,240,255,0.35)] transition-[width,height] duration-150"
        style={{ width: size, height: size }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <Icon
            name="radar"
            filled
            className="text-3xl text-cyan-400 drop-shadow-[0_0_10px_rgba(0,240,255,0.7)]"
          />
        </div>
      </div>
    </div>
  );
}

type SignalTimelineProps = {
  getHistory: Parameters<typeof DowsingTimeChart>[0]["getHistory"];
  historyCapacity: number;
  active: boolean;
};

function SignalTimeline({
  getHistory,
  historyCapacity,
  active,
}: SignalTimelineProps) {
  return (
    <div className="mt-6 border border-cyan-900/40 bg-[#05070A]/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
          SIGNAL_TIMELINE
        </span>
        <span className="font-mono text-[10px] text-cyan-400">LIVE</span>
      </div>
      <DowsingTimeChart
        getHistory={getHistory}
        historyCapacity={historyCapacity}
        active={active}
        theme="cyber"
        showSeries={{ peak: true }}
      />
    </div>
  );
}

function UnavailableBody({ errorReason }: { errorReason: string | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 border-l-2 border-cyan-900/60 bg-cyan-950/20 p-3">
        <Icon name="mic_off" className="mt-0.5 text-cyan-500/80" />
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">
            {t("dowsing.unavailableTitle")}
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            {t("dowsing.unavailableBody")}
          </p>
          {errorReason && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
              REASON: {errorReason}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border border-cyan-900/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant hover:border-cyan-400 hover:text-cyan-400"
      >
        <span>{t("dowsing.permissionToggle")}</span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-sm" />
      </button>
      {open && (
        <div className="space-y-2 border border-cyan-900/30 p-3 text-xs leading-relaxed text-on-surface-variant">
          <p className="font-bold text-cyan-400">iOS Safari</p>
          <p>{t("dowsing.permissionIosBody")}</p>
          <p className="mt-2 font-bold text-cyan-400">Android Chrome</p>
          <p>{t("dowsing.permissionAndroidBody")}</p>
        </div>
      )}
    </div>
  );
}
