import { drizzle } from "drizzle-orm/d1";
import { useMemo, useState } from "react";
import * as schema from "../../db/schema";
import { Icon } from "~/components";
import { DowsingSpectrumChart } from "~/components/dowsing-spectrum-chart";
import { DowsingTimeChart } from "~/components/dowsing-time-chart";
import { OperatorShell } from "~/components/operator";
import {
  type DetectionMethod,
  FREQ_Q1_1_HZ,
  FREQ_Q1_2_HZ,
  clamp,
} from "~/lib/dowsing/config";
import { useDetectionMethod } from "~/lib/dowsing/use-detection-method";
import {
  type HistoryBuffers,
  type ProximityMetric,
  useProximity,
} from "~/lib/dowsing/use-proximity";
import { useToneGenerator } from "~/lib/dowsing/use-tone-generator";
import { requireOperatorSession } from "~/lib/operator/session";
import type { Route } from "./+types/operator.dowsing-test";

export function meta() {
  return [{ title: "ダウジングテスト | Operator | icho26" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  await requireOperatorSession(request, db);
  return null;
}

const FREQ_PRESETS: { label: string; hz: number }[] = [
  { label: "Q1-1", hz: FREQ_Q1_1_HZ },
  { label: "Q1-2", hz: FREQ_Q1_2_HZ },
  { label: "18.6k", hz: 18600 },
  { label: "19k", hz: 19000 },
  { label: "19.5k", hz: 19500 },
  { label: "20k", hz: 20000 },
];

const FREQ_MIN = 15000;
const FREQ_MAX = 22000;

export default function OperatorDowsingTest() {
  const [txFreq, setTxFreq] = useState(FREQ_Q1_1_HZ);
  const [txLevel, setTxLevel] = useState(0.3);
  const [rxFreq, setRxFreq] = useState(FREQ_Q1_1_HZ);
  const [linkFreq, setLinkFreq] = useState(true);

  const tone = useToneGenerator(txFreq);
  const [method, setMethod] = useDetectionMethod();
  const proximity = useProximity(rxFreq);

  // TX/RX 周波数を連動させるオプション
  const onTxFreqChange = (hz: number) => {
    setTxFreq(hz);
    if (linkFreq) {
      setRxFreq(hz);
    }
    if (tone.state === "playing") {
      tone.setFrequency(hz);
    }
  };

  const onRxFreqChange = (hz: number) => {
    setRxFreq(hz);
    if (linkFreq) {
      setTxFreq(hz);
      if (tone.state === "playing") {
        tone.setFrequency(hz);
      }
    }
  };

  const onTxLevelChange = (next: number) => {
    setTxLevel(next);
    if (tone.state === "playing") {
      tone.setLevel(next);
    }
  };

  return (
    <OperatorShell title="ダウジングテスト" eyebrow="DOWSING_TEST">
      <p className="mb-6 max-w-2xl text-sm text-gray-600">
        端末スピーカーから連続正弦波を発信しながら、同じ端末（または別端末）の
        マイクでピーク方式とエネルギー合計方式を**同時計測**して比較できます。
        二台で運用する場合は片方を送信、もう片方を受信に設定してください。
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TransmitterPanel
          freq={txFreq}
          level={txLevel}
          state={tone.state}
          errorReason={tone.errorReason}
          linkFreq={linkFreq}
          onLinkChange={setLinkFreq}
          onFreqChange={onTxFreqChange}
          onLevelChange={onTxLevelChange}
          onStart={() => void tone.start(txFreq, txLevel)}
          onStop={() => tone.stop()}
        />

        <ReceiverPanel
          freq={rxFreq}
          method={method}
          state={proximity.state}
          metrics={proximity.metrics}
          errorReason={proximity.errorReason}
          getSpectrum={proximity.getSpectrum}
          sampleRate={proximity.sampleRate}
          getHistory={proximity.getHistory}
          historyCapacity={proximity.historyCapacity}
          onFreqChange={onRxFreqChange}
          onMethodChange={setMethod}
          onStart={() => void proximity.start()}
          onStop={() => proximity.stop()}
        />
      </div>

      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">使い方のヒント</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            iOS Safari は AudioContext / マイクともに「ボタン押下」必須。それぞれ
            START を押してください。
          </li>
          <li>
            両方式を同時に計算しているので、メソッド切替トグルは「現在 active な
            ゲーム画面の表示にどちらを採用するか」を切替えます（
            localStorage に保存・他タブにも反映）。
          </li>
          <li>
            キャリブレーションは RX START 直後の 1.5
            秒で行います。送信機を OFF にした状態で開始すると正確なノイズフロアが取れます。
          </li>
        </ul>
      </div>
    </OperatorShell>
  );
}

type TxPanelProps = {
  freq: number;
  level: number;
  state: "idle" | "playing" | "unavailable";
  errorReason: string | null;
  linkFreq: boolean;
  onLinkChange: (v: boolean) => void;
  onFreqChange: (hz: number) => void;
  onLevelChange: (level: number) => void;
  onStart: () => void;
  onStop: () => void;
};

function TransmitterPanel(props: TxPanelProps) {
  const playing = props.state === "playing";

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        <Icon name="campaign" className="text-base text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">送信機 (TX)</h2>
        <StatusPill
          tone={
            props.state === "playing"
              ? "active"
              : props.state === "unavailable"
                ? "warn"
                : "idle"
          }
          label={
            props.state === "playing"
              ? "PLAYING"
              : props.state === "unavailable"
                ? "UNAVAILABLE"
                : "IDLE"
          }
        />
      </header>

      <FrequencyControl
        label="周波数"
        freq={props.freq}
        onChange={props.onFreqChange}
      />

      <div className="mt-4">
        <label className="flex items-center justify-between text-xs font-medium text-gray-700">
          <span>出力レベル</span>
          <span className="font-mono tabular-nums text-gray-500">
            {(props.level * 100).toFixed(0)}%
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={props.level}
          onChange={(e) => props.onLevelChange(Number(e.target.value))}
          className="mt-1 w-full"
        />
        <p className="mt-1 text-[10px] text-gray-500">
          初回は 30% 前後で開始し、隣接設問への混信を確認してから調整してください。
        </p>
      </div>

      <label className="mt-4 flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={props.linkFreq}
          onChange={(e) => props.onLinkChange(e.target.checked)}
        />
        TX / RX の周波数を連動
      </label>

      <div className="mt-5 flex gap-2">
        {!playing ? (
          <button
            type="button"
            onClick={props.onStart}
            className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <Icon name="play_arrow" className="mr-1 align-middle text-base" />
            発信開始
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onStop}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <Icon name="stop" className="mr-1 align-middle text-base" />
            停止
          </button>
        )}
      </div>

      {props.errorReason && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ERROR: {props.errorReason}
        </p>
      )}
    </section>
  );
}

type RxPanelProps = {
  freq: number;
  method: DetectionMethod;
  state: "idle" | "requesting" | "active" | "unavailable";
  metrics: { peak: ProximityMetric; energy: ProximityMetric };
  errorReason: string | null;
  getSpectrum: (out: Float32Array) => boolean;
  sampleRate: number;
  getHistory: (out: HistoryBuffers) => number;
  historyCapacity: number;
  onFreqChange: (hz: number) => void;
  onMethodChange: (m: DetectionMethod) => void;
  onStart: () => void;
  onStop: () => void;
};

function ReceiverPanel(props: RxPanelProps) {
  const isActive = props.state === "active";

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        <Icon name="hearing" className="text-base text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">受信機 (RX)</h2>
        <StatusPill
          tone={
            props.state === "active"
              ? "active"
              : props.state === "requesting"
                ? "info"
                : props.state === "unavailable"
                  ? "warn"
                  : "idle"
          }
          label={
            props.state === "active"
              ? "ACTIVE"
              : props.state === "requesting"
                ? "CALIBRATING"
                : props.state === "unavailable"
                  ? "UNAVAILABLE"
                  : "IDLE"
          }
        />
      </header>

      <FrequencyControl
        label="受信中心周波数"
        freq={props.freq}
        onChange={props.onFreqChange}
      />

      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-gray-700">検出方式</p>
        <div className="flex gap-2">
          <MethodToggle
            active={props.method === "peak"}
            onClick={() => props.onMethodChange("peak")}
            label="Peak"
            sub="広帯域 dB ピーク"
          />
          <MethodToggle
            active={props.method === "energy_sum"}
            onClick={() => props.onMethodChange("energy_sum")}
            label="Energy Sum"
            sub="狭帯域 magnitude 合計"
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {props.state === "idle" || props.state === "unavailable" ? (
          <button
            type="button"
            onClick={props.onStart}
            className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <Icon name="mic" className="mr-1 align-middle text-base" />
            受信開始
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onStop}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
            disabled={props.state === "requesting"}
          >
            <Icon name="stop" className="mr-1 align-middle text-base" />
            停止
          </button>
        )}
      </div>

      {props.errorReason && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ERROR: {props.errorReason}
        </p>
      )}

      {isActive && (
        <>
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-gray-700">
              スペクトル（target ±2 kHz）
            </p>
            <DowsingSpectrumChart
              getSpectrum={props.getSpectrum}
              sampleRate={props.sampleRate}
              targetFreqHz={props.freq}
              active={isActive}
            />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-gray-700">
              signalDb の時系列（自動スケール）
            </p>
            <DowsingTimeChart
              getHistory={props.getHistory}
              historyCapacity={props.historyCapacity}
              active={isActive}
              highlight={props.method}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricCard
              title="Peak"
              metric={props.metrics.peak}
              highlighted={props.method === "peak"}
            />
            <MetricCard
              title="Energy Sum"
              metric={props.metrics.energy}
              highlighted={props.method === "energy_sum"}
            />
          </div>
        </>
      )}
    </section>
  );
}

function MethodToggle({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-md border px-3 py-2 text-left text-xs transition-colors",
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
      ].join(" ")}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span
        className={
          active
            ? "block text-[10px] text-gray-300"
            : "block text-[10px] text-gray-500"
        }
      >
        {sub}
      </span>
    </button>
  );
}

function MetricCard({
  title,
  metric,
  highlighted,
}: {
  title: string;
  metric: ProximityMetric;
  highlighted: boolean;
}) {
  const proximity = clamp(metric.proximity, 0, 100);
  return (
    <div
      className={[
        "rounded-md border p-3",
        highlighted
          ? "border-gray-900 bg-gray-50"
          : "border-gray-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          {title}
        </span>
        {highlighted && (
          <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            ACTIVE
          </span>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-cyan-500 transition-[width] duration-100"
          style={{ width: `${proximity}%` }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-gray-700">
        <dt className="text-gray-500">proximity</dt>
        <dd className="text-right">{proximity.toFixed(1)}</dd>
        <dt className="text-gray-500">raw</dt>
        <dd className="text-right">{metric.raw.toFixed(1)}</dd>
        <dt className="text-gray-500">signalDb</dt>
        <dd className="text-right">{metric.signalDb.toFixed(2)}</dd>
      </dl>
    </div>
  );
}

function FrequencyControl({
  label,
  freq,
  onChange,
}: {
  label: string;
  freq: number;
  onChange: (hz: number) => void;
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-xs font-medium text-gray-700">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-gray-500">
          {(freq / 1000).toFixed(2)} kHz
        </span>
      </label>
      <input
        type="range"
        min={FREQ_MIN}
        max={FREQ_MAX}
        step={50}
        value={freq}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {FREQ_PRESETS.map((p) => (
          <button
            key={p.hz}
            type="button"
            onClick={() => onChange(p.hz)}
            className={[
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors",
              freq === p.hz
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type PillTone = "idle" | "active" | "warn" | "info";

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const cls = useMemo(() => {
    switch (tone) {
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "warn":
        return "bg-red-100 text-red-700";
      case "info":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }, [tone]);
  return (
    <span
      className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${cls}`}
    >
      {label}
    </span>
  );
}

