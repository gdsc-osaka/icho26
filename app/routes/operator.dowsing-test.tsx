import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackgroundFX,
  GlowButton,
  Icon,
  StageHeader,
  SystemPanel,
  TopBar,
} from "~/components";
import {
  FREQ_Q1_1_HZ,
  FREQ_Q1_2_HZ,
  TONE_DEFAULT_LEVEL,
  TONE_FADE_MS,
} from "~/lib/dowsing/config";

export function meta() {
  return [{ title: "Dowsing Test Tone | icho26" }];
}

type ChannelKey = "q1_1" | "q1_2";

const CHANNELS: Record<ChannelKey, { label: string; freq: number }> = {
  q1_1: { label: "Q1-1 (18.6 kHz)", freq: FREQ_Q1_1_HZ },
  q1_2: { label: "Q1-2 (20.0 kHz)", freq: FREQ_Q1_2_HZ },
};

type ToneRefs = {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
};

export default function DowsingTestTone() {
  // 各チャンネルが現在 ON か
  const [active, setActive] = useState<Record<ChannelKey, boolean>>({
    q1_1: false,
    q1_2: false,
  });
  const [level, setLevel] = useState<number>(TONE_DEFAULT_LEVEL);
  const refs = useRef<Record<ChannelKey, ToneRefs | null>>({
    q1_1: null,
    q1_2: null,
  });
  const levelRef = useRef(level);

  useEffect(() => {
    levelRef.current = level;
    // 既に鳴っているチャンネルがあれば即座にゲインを反映
    for (const key of Object.keys(refs.current) as ChannelKey[]) {
      const r = refs.current[key];
      if (r && r.ctx.state !== "closed") {
        try {
          r.gain.gain.setTargetAtTime(level, r.ctx.currentTime, 0.05);
        } catch {
          /* ignore */
        }
      }
    }
  }, [level]);

  const startTone = useCallback(async (key: ChannelKey) => {
    if (refs.current[key]) return;
    const AudioCtx =
      typeof window === "undefined"
        ? null
        : window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = CHANNELS[key].freq;
    const fadeS = TONE_FADE_MS / 1000;
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(levelRef.current, t0 + fadeS);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    refs.current[key] = { ctx, osc, gain };
    setActive((prev) => ({ ...prev, [key]: true }));
  }, []);

  const stopTone = useCallback(async (key: ChannelKey) => {
    const r = refs.current[key];
    if (!r) return;
    refs.current[key] = null;
    setActive((prev) => ({ ...prev, [key]: false }));
    const fadeS = TONE_FADE_MS / 1000;
    try {
      const t0 = r.ctx.currentTime;
      r.gain.gain.cancelScheduledValues(t0);
      r.gain.gain.setValueAtTime(r.gain.gain.value, t0);
      r.gain.gain.linearRampToValueAtTime(0, t0 + fadeS);
      r.osc.stop(t0 + fadeS + 0.02);
    } catch {
      /* ignore */
    }
    // fade 完了後に context をクローズ
    window.setTimeout(() => {
      void r.ctx.close().catch(() => undefined);
    }, TONE_FADE_MS + 50);
  }, []);

  // アンマウント時に全チャネル停止
  useEffect(() => {
    const refsAtMount = refs.current;
    return () => {
      for (const key of Object.keys(refsAtMount) as ChannelKey[]) {
        const r = refsAtMount[key];
        if (!r) continue;
        try {
          r.osc.stop();
        } catch {
          /* ignore */
        }
        void r.ctx.close().catch(() => undefined);
        refsAtMount[key] = null;
      }
    };
  }, []);

  return (
    <>
      <TopBar sessionId="OPERATOR" rightIcon="graphic_eq" />
      <BackgroundFX />
      <main className="relative z-10 mx-auto max-w-lg space-y-6 px-6 pt-20 pb-12">
        <StageHeader title="DOWSING TEST TONE" eyebrow="VENUE TUNING">
          <p>
            18.6 / 20.0 kHz の超音波サイン波を端末スピーカーから出力します。
            会場のスピーカー設置・出力レベル調整・端末マイク受信確認に使用してください。
          </p>
        </StageHeader>

        <SystemPanel className="space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <Icon name="tune" className="text-sm" />
            <h2 className="font-mono text-[10px] uppercase tracking-widest">
              OUTPUT LEVEL
            </h2>
          </div>
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <p className="text-right font-mono text-xs text-cyan-400">
              {(level * 100).toFixed(0)} %
            </p>
          </div>
        </SystemPanel>

        {(Object.keys(CHANNELS) as ChannelKey[]).map((key) => (
          <SystemPanel key={key}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
                  CHANNEL
                </p>
                <h3 className="font-display text-base font-bold uppercase tracking-widest text-cyan-400">
                  {CHANNELS[key].label}
                </h3>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-cyan-900">
                  {active[key] ? "EMITTING" : "STANDBY"}
                </p>
              </div>
              <GlowButton
                type="button"
                onClick={() => (active[key] ? stopTone(key) : startTone(key))}
                variant={active[key] ? "danger" : "primary"}
              >
                {active[key] ? "STOP" : "START"}
              </GlowButton>
            </div>
          </SystemPanel>
        ))}

        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-900">
          NOTE: Fade in/out {TONE_FADE_MS} ms applied to suppress click
          artifacts.
        </p>
      </main>
    </>
  );
}
