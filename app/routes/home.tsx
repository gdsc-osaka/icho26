import { useTranslation } from "react-i18next";
import { GlowButton, Icon, PageShell, SystemPanel } from "~/components";

export function meta() {
  return [
    { title: "icho26 / SYSTEM IDLE" },
    {
      name: "description",
      content: "GDGoC Osaka いちょう祭ストーリー謎解き",
    },
  ];
}

export default function Home() {
  const { t } = useTranslation();
  return (
    <PageShell sessionId="ID: ----" rightIcon="sensors">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-8">
        <IrisAvatar />

        <div className="space-y-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-cyan-500/60">
            ACCESSING CLASSIFIED DATABASE
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)] md:text-4xl">
            IRIS SYSTEM REPAIR
          </h1>
          <div className="mx-auto h-px w-24 bg-cyan-500/50" />
        </div>

        <SystemPanel className="w-full">
          <p className="text-center text-base leading-relaxed text-on-surface">
            {t("home.scanPrompt")}
          </p>
        </SystemPanel>

        <div className="flex flex-col items-center gap-4 pt-2">
          <GlowButton type="button" disabled>
            QR REQUIRED
          </GlowButton>
          <div className="flex items-center gap-2 border border-cyan-900/40 bg-cyan-900/10 px-3 py-1">
            <Icon name="fingerprint" className="text-[12px] text-cyan-600" />
            <span className="font-mono text-[10px] uppercase text-cyan-600">
              SYSTEM IDLE
            </span>
          </div>
        </div>
      </div>
      <StatusFooter status="SYSTEM_IDLE" />
    </PageShell>
  );
}

function IrisAvatar() {
  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      <div className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border border-cyan-500/20" />
      <div className="absolute inset-3 animate-[spin_8s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-400/40" />
      <div className="iris-glow flex h-20 w-20 rotate-45 items-center justify-center border-2 border-cyan-400">
        <div className="h-12 w-12 -rotate-45 border border-cyan-400" />
      </div>
      <div className="absolute inset-0 animate-pulse rounded-full bg-cyan-500/5 blur-3xl" />
    </div>
  );
}

function StatusFooter({ status }: { status: string }) {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-between border-t border-cyan-900/30 px-6 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-900">
      <span className="flex items-center gap-2">
        <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400" />
        {status}
      </span>
      <span>© ZEUS CORP</span>
    </footer>
  );
}
