import { GlowButton, StageHeader, SystemPanel } from "~/components";

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
  return (
    <main className="mx-auto max-w-md px-6 py-12 space-y-6">
      <SystemPanel>
        <StageHeader title="ICHO26 / SYSTEM IDLE">
          <p className="font-mono text-text-primary">
            {">"} AI Iris : awaiting credential.
          </p>
        </StageHeader>
        <p className="mt-6 text-sm leading-relaxed text-text-secondary">
          来場者用 QR をスキャンしてゲームを開始してください。 QR
          が見つからない場合は運営スタッフにお声がけください。
        </p>
      </SystemPanel>
      <div className="flex justify-center">
        <GlowButton type="button" disabled>
          QR REQUIRED
        </GlowButton>
      </div>
    </main>
  );
}
