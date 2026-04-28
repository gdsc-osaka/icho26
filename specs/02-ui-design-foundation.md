# 02 UI / デザイン基盤

依存: `00-architecture.md`

このドキュメントはデザイントークン、共通 UI コンポーネント、フォント読込み等の UI 基盤を定義する。視覚デザインの方針は `design.md` を一次資料とし、ここでは実装方針を扱う。

## 1. 設計方針

- Tailwind CSS v4 を主軸に、`@theme` でデザイントークンを集中管理する
- 共通 atoms は `app/components/` に置き、複数ルートで再利用する
- feature 固有 UI は最初ルートファイル内に直書きし、再利用が出てきた時点で `app/lib/<feature>/components/` へ切り出す
- モバイルファースト(縦持ちスマホ基準、最小タップ領域 44x44px)
- `<html lang="ja">`

## 2. デザイントークン(`app/app.css`)

```css
@import "tailwindcss";

@theme {
  /* color */
  --color-bg-primary: #111417;
  --color-bg-surface: #1a1e23;
  --color-accent: #00F0FF;
  --color-accent-dim: #00F0FF33;
  --color-danger: #FF4D4D;
  --color-text-primary: #E8EAED;
  --color-text-secondary: #9AA0A6;

  /* font */
  --font-display: "Space Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

これにより `bg-bg-primary`、`text-accent`、`font-mono` などのユーティリティクラスとして利用できる。

## 3. フォント読込み

`root.tsx` の `links` で Google Fonts を読み込む。

```typescript
export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
];
```

## 4. 共通 UI コンポーネント

`app/components/` に置く。単一ファイル単位の React コンポーネント。

| コンポーネント | 役割 | ファイル |
|---|---|---|
| `SystemPanel` | 表面色のカードコンテナ。各ステージ画面のメインブロック | `system-panel.tsx` |
| `GlowButton` | アクセント色で発光するメインアクションボタン | `glow-button.tsx` |
| `TextInput` | 回答入力フィールド。`inputmode` 属性を props で指定可 | `text-input.tsx` |
| `ErrorAlert` | 警告色のインラインエラー表示 | `error-alert.tsx` |
| `LoadingOverlay` | 送信中のオーバーレイ | `loading-overlay.tsx` |
| `StageHeader` | 画面上部のステージ表示・ストーリーテキスト | `stage-header.tsx` |
| `MonospaceLog` | システムログ風のテキストブロック(`font-mono`) | `monospace-log.tsx` |

各コンポーネントは:

- props は最小限に絞る(`children`、`onClick`、`disabled` など)
- スタイリングは Tailwind ユーティリティで完結させる
- 内部状態を持たない(必要なら呼び出し側で管理する)

### 4.1 命名と export

ファイル名は kebab-case、export はパスカルケース。

```typescript
// app/components/system-panel.tsx
export function SystemPanel({ children }: { children: React.ReactNode }) { ... }
```

`app/components/index.ts` で集約 re-export する。

## 5. レスポンシブ

- 来場者画面: `max-w-md`(448px)中央寄せをベースとする
- 運営ダッシュボードのみ `md` 以上でワイドレイアウト
- 入力フィールドは `inputmode` 属性で適切なキーボードを表示
  - 数値: `inputmode="decimal"`
  - テキスト: `inputmode="text"`

## 6. アニメーション・複雑な視覚効果

Tailwind ユーティリティで書きにくい以下のような表現は CSS で書く:

- 偽エンドの **タイプライター演出**
- エピローグの **グリッチエフェクト** + 警告色フラッシュ
- アクセント色の **発光(glow)** 表現

書く場所:

- 汎用化できるもの → `app/app.css` の `@layer components` または `@utilities`
- ルート固有 → 該当ルートファイル内 `<style>` または同階層の `<route>.css`

## 7. ストーリーテキスト

各ステージの導入・完了テキストは `docs/story.md` を一次資料とし、03(参加者 feature)で各ルートに配置する。本ドキュメントではフォントとレイアウトの方針のみ定義する。

タイプライター演出を行う場合は `MonospaceLog` ベースで、文字を 1 つずつ追記する CSS / JS を採用する。実装はルートに直書きで構わない。

## 8. アクセシビリティ最低ライン

- すべてのボタンに `type="button"` か `type="submit"` を明示
- アイコンのみのボタンは `aria-label` を付ける
- フォーム送信時は `disabled` で二重送信を防ぐ
- 色のみで状態を伝えない(エラーは色 + テキスト併記)

過剰な対応はしない(本イベントは特定環境向けの一時的な体験のため)。
