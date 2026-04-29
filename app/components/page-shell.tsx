import type { ReactNode } from "react";
import { BackgroundFX } from "./background-fx";
import { TopBar } from "./top-bar";

type Props = {
  children: ReactNode;
  /** TopBar 右肩のセッションID表示 */
  sessionId?: string;
  /** TopBar 右肩のアイコン名 */
  rightIcon?: string;
  /** 下部ナビ等のフッター */
  footer?: ReactNode;
  /** 横幅クラス。デフォルト max-w-lg */
  widthClass?: string;
};

export function PageShell({
  children,
  sessionId,
  rightIcon,
  footer,
  widthClass = "max-w-lg",
}: Props) {
  return (
    <>
      <TopBar sessionId={sessionId} rightIcon={rightIcon} />
      <BackgroundFX />
      <main
        className={`relative z-10 mx-auto flex min-h-screen flex-col px-6 pt-20 pb-32 ${widthClass}`}
      >
        {children}
      </main>
      {footer}
    </>
  );
}
