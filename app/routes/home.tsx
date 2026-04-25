import type { Route } from "./+types/home";
import {
  AppShell,
  ErrorAlert,
  GlowButton,
  MonospaceLog,
  StageHeader,
  SystemPanel,
  TextInput,
} from "~/shared/ui";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "IRIS — Synthetic Intelligence Interface" },
    { name: "description", content: "AI イリス修復ミッション" },
  ];
}

export default function Home() {
  return (
    <AppShell>
      <StageHeader stage="SYSTEM / BOOT" title="IRIS REPAIR PROTOCOL">
        共通 UI コンポーネントのプレビューです。Step 3 (design + ui) の表示確認用。
      </StageHeader>

      <SystemPanel>
        <div className="flex flex-col gap-4">
          <TextInput
            label="ANSWER"
            placeholder="input normalized value"
            inputMode="text"
            hint="正規化後の値がサーバーへ送られます"
          />
          <GlowButton variant="primary" size="lg">
            SUBMIT
          </GlowButton>
          <GlowButton variant="secondary">RESUME</GlowButton>
          <GlowButton variant="danger">ABORT</GlowButton>
        </div>
      </SystemPanel>

      <ErrorAlert title="AUTH FAIL">認証失敗。入力値を再確認してください。</ErrorAlert>

      <MonospaceLog>
        {`> boot sequence initialized
> loading modules... OK
> awaiting participant input`}
      </MonospaceLog>
    </AppShell>
  );
}
