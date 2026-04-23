# 13 フロントエンド UI ルーティングとコンポーネント仕様

このドキュメントは、来場者向け・運営向けの画面構成、ルーティング、UI コンポーネント設計を定義する。

依存: `04-application-skeleton-and-dependency-injection.md`, `07-participant-api-implementation-details.md`, `08-operator-auth-and-api-implementation-details.md`

## 1. 設計方針

- モバイルファースト（縦持ちスマホ基準、主要タップ領域 44px 以上）
- React Router v7 Framework Mode の `loader` / `action` でサーバー連携
- 画面遷移ガードは `loader` で進捗状態を検証し、未解放画面へのアクセスを拒否
- デザインは `design.md` の "Synthetic Intelligence Interface" テーマに準拠
- クライアント状態は最小限に保ち、サーバー状態（D1）を信頼する
- ストーリーテキストは `docs/story.md` を参照する

### 1.1 初期実装でのモック方針

以下の機能は初期実装ではモック／簡易実装で代用し、後続タスクで本実装に差し替える。

| 機能 | 初期実装 | 本実装（後続） |
|------|----------|----------------|
| 音源探知 / AR | 画面スキップ（detect ルート自体を省略し、回答正解後に直接 checkpoint へ遷移） | Web Audio API による超音波検知 |
| AI チャット（イリス） | 固定メッセージ表示のモック UI（API 接続なし） | LLM 連携の段階ヒントチャット |
| NFC タッチ | 会場 QR / 直リンクで checkpoint URL を開き、ボタン押下で確認 API を叩く | Web NFC API 連携 |
| 正解データ | 仮の固定値（後述 §18） | 本番正解テーブル |
| QR 生成 | 運営ダッシュボードに groupId のテキスト表示 + 外部 QR ツールへの導線 | アプリ内 QR 生成・印刷 |

## 2. ルート一覧

### 2.1 来場者向け

| パス | ファイル | 役割 |
|------|----------|------|
| `/start/:groupId` | `routes/start.$groupId.tsx` | セッション開始・再開 |
| `/q1` | `routes/q1.tsx` | Q1 ハブ（サブ設問進捗表示） |
| `/q1/1` | `routes/q1.1.tsx` | Q1-1 方程式パズル |
| `/q1/2` | `routes/q1.2.tsx` | Q1-2 周辺スキャン |
| `/q1/:sub/checkpoint` | `routes/q1.$sub.checkpoint.tsx` | Q1 チェックポイント確認 |
| `/q2` | `routes/q2.tsx` | Q2 暗号入力 |
| `/q2/checkpoint` | `routes/q2.checkpoint.tsx` | Q2 チェックポイント確認 |
| `/q3` | `routes/q3.tsx` | Q3 キーワード入力 |
| `/q3/code` | `routes/q3.code.tsx` | Q3 数値コード入力 |
| `/q4` | `routes/q4.tsx` | Q4 定数認証 |
| `/fake-end` | `routes/fake-end.tsx` | 偽ハッピーエンド演出 |
| `/complete` | `routes/complete.tsx` | コンプリートハブ |
| `/complete/epilogue` | `routes/complete.epilogue.tsx` | エピローグ |
| `/complete/explain` | `routes/complete.explain.tsx` | ギミック解説 |
| `/complete/report` | `routes/complete.report.tsx` | スタッフ報告提示 |

初期実装では AR 信号探知ルート（`/q1/:sub/detect`）を省略する。
回答正解後は直接 checkpoint 画面へ遷移する。

### 2.2 運営向け

| パス | ファイル | 役割 |
|------|----------|------|
| `/operator/login` | `routes/operator.login.tsx` | ログイン画面 |
| `/operator` | `routes/operator.tsx` | レイアウト（認証ガード） |
| `/operator/dashboard` | `routes/operator.dashboard.tsx` | 進捗ダッシュボード |
| `/operator/group/:groupId` | `routes/operator.group.$groupId.tsx` | グループ詳細・補正操作 |

## 3. routes.ts 定義

```typescript
import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // 来場者
  route("start/:groupId", "routes/start.$groupId.tsx"),
  route("q1", "routes/q1.tsx"),
  route("q1/1", "routes/q1.1.tsx"),
  route("q1/2", "routes/q1.2.tsx"),
  route("q1/:sub/checkpoint", "routes/q1.$sub.checkpoint.tsx"),
  route("q2", "routes/q2.tsx"),
  route("q2/checkpoint", "routes/q2.checkpoint.tsx"),
  route("q3", "routes/q3.tsx"),
  route("q3/code", "routes/q3.code.tsx"),
  route("q4", "routes/q4.tsx"),
  route("fake-end", "routes/fake-end.tsx"),
  route("complete", "routes/complete.tsx"),
  route("complete/epilogue", "routes/complete.epilogue.tsx"),
  route("complete/explain", "routes/complete.explain.tsx"),
  route("complete/report", "routes/complete.report.tsx"),

  // 運営
  route("operator/login", "routes/operator.login.tsx"),
  layout("routes/operator.tsx", [
    route("operator/dashboard", "routes/operator.dashboard.tsx"),
    route("operator/group/:groupId", "routes/operator.group.$groupId.tsx"),
  ]),
] satisfies RouteConfig;
```

## 4. セッション識別（来場者）

来場者はログイン不要。セッション識別は以下の方式で行う。

1. `/start/:groupId` の `loader` で `groupId` を検証し、セッション開始 API を呼び出す
2. 成功時に `groupId` を Cookie に保存（`HttpOnly`, `Secure`, `SameSite=Strict`）
3. 以降の画面では Cookie から `groupId` を取得し、`loader` で進捗を参照する
4. Cookie がない状態で問題画面にアクセスした場合は `/` へリダイレクト

Cookie 名: `group_session`
有効期限: 24 時間（祭当日の体験時間を十分カバー）

## 5. 画面遷移ガード

すべての問題画面の `loader` で共通のガードロジックを適用する。

```typescript
// 共通ガードの擬似コード
async function guardLoader(context, requiredStage) {
  const groupId = getGroupIdFromCookie(context.request);
  if (!groupId) throw redirect("/");

  const progress = await getProgress(context, groupId);

  if (!isStageAccessible(progress.currentStage, requiredStage)) {
    // 現在の正しい画面へリダイレクト
    throw redirect(stageToPath(progress.currentStage));
  }

  return progress;
}
```

### ステージ → パス マッピング

| currentStage | リダイレクト先 |
|---|---|
| `START` | `/start/:groupId`（Cookie 未設定なら `/`） |
| `Q1` | `/q1` |
| `Q2` | `/q2` |
| `Q3_KEYWORD` | `/q3` |
| `Q3_CODE` | `/q3/code` |
| `Q4` | `/q4` |
| `FAKE_END` | `/fake-end` |
| `COMPLETE` | `/complete` |

## 6. 運営認証ガード

`routes/operator.tsx` をレイアウトルートとし、`loader` でセッション検証を行う。

```typescript
// routes/operator.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await verifyOperatorSession(request, context);
  if (!session) throw redirect("/operator/login");
  return { operator: session };
}

export default function OperatorLayout() {
  return <Outlet />;
}
```

未認証・期限切れ・失効時は `/operator/login` へリダイレクトする。

## 7. コンポーネント構成

### 7.1 共通 UI コンポーネント（`app/shared/ui/`）

| コンポーネント | 役割 |
|---|---|
| `SystemPanel` | ネイビー背景のカードコンテナ |
| `GlowButton` | シアン発光ボタン（メインアクション用） |
| `TextInput` | 回答入力フィールド（正規化表示付き） |
| `ErrorAlert` | 警告レッドのエラー表示 |
| `LoadingOverlay` | 送信中のローディング表示 |
| `StageHeader` | 各画面上部のステージ表示とストーリーテキスト |
| `MonospaceLog` | システムログ風テキスト表示 |

### 7.2 機能固有コンポーネント（各 route ファイル内またはコロケーション）

- Q1 ハブ: サブ設問進捗カード（ロック/アンロック/完了状態表示）
- チェックポイント: 「確認」ボタン + 説明テキスト（初期実装、§15 参照）
- 偽エンド: チャット形式テキスト演出（タイプライター効果）
- エピローグ: グリッチエフェクト + 警告レッド演出
- ダッシュボード: グループ一覧テーブル + ステータスバッジ

## 8. 回答送信フロー（action パターン）

問題画面の回答送信は React Router の `action` で処理する。

```typescript
// routes/q2.tsx の例
export async function action({ request, context }: Route.ActionArgs) {
  const groupId = getGroupIdFromCookie(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const answer = String(formData.get("answer"));

  const container = getContainer(context.cloudflare.env);
  const result = await container.submitAnswerUseCase.execute({
    groupId,
    stage: "Q2",
    answer,
    idempotencyKey: String(formData.get("idempotencyKey")),
  });

  if (result.isErr()) {
    return { error: result.error };
  }

  // 正解 → 次の画面へリダイレクト
  if (result.value.correct) {
    return redirect("/q2/checkpoint");
  }

  // 不正解 → 同一画面にエラー表示
  return { incorrect: true, attemptCount: result.value.attemptCount };
}
```

## 9. 冪等キー生成（クライアント）

更新系フォーム送信時にクライアントで冪等キーを生成し、hidden フィールドとして送信する。

```typescript
// app/shared/ui/use-idempotency-key.ts
import { useId, useMemo } from "react";

export function useIdempotencyKey() {
  const reactId = useId();
  return useMemo(() => `${reactId}-${crypto.randomUUID()}`, [reactId]);
}
```

- フォーム表示時に 1 回だけ生成する
- 再送信（不正解後の再入力）では新しいキーを生成する
- 同一キーの二重送信はサーバー側で冪等処理される

## 10. エラー表示

### 10.1 回答エラー（不正解）

同一画面内でインラインエラーメッセージを表示する。ストーリーに合わせた表現にする。

例: 「認証失敗。入力値を再確認してください。」

### 10.2 競合エラー（CONFLICT_STATE）

`loader` で最新進捗を再取得し、正しい画面へリダイレクトする。
ユーザーにはエラーを見せず、自然に正しい画面へ遷移させる。

### 10.3 システムエラー（INTERNAL_ERROR）

`ErrorBoundary` でキャッチし、リトライ導線を表示する。

例: 「通信エラーが発生しました。再試行してください。」

## 11. デザイントークン

`design.md` に基づき、Tailwind CSS v4 のカスタムテーマとして定義する。

```css
/* app/app.css */
@import "tailwindcss";

@theme {
  --color-bg-primary: #111417;
  --color-bg-surface: #1a1e23;
  --color-accent: #00F0FF;
  --color-accent-dim: #00F0FF33;
  --color-danger: #FF4D4D;
  --color-text-primary: #E8EAED;
  --color-text-secondary: #9AA0A6;

  --font-display: "Space Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

## 12. フォント読み込み

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

## 13. レスポンシブ方針

- ベースはモバイル幅（`max-w-md` = 448px 中央寄せ）
- 運営ダッシュボードのみ `md` ブレークポイントでワイドレイアウト
- タップ領域は最小 44x44px を維持
- 入力フィールドは `inputmode` 属性で適切なキーボードを表示
  - 数値入力: `inputmode="decimal"`
  - テキスト入力: `inputmode="text"`
- `lang="ja"` を `<html>` に設定

## 14. ヒントチャット UI（初期モック）

各問題画面の下部にチャット導線ボタンを配置する。

初期実装:
- ボタンタップでチャットパネルをスライドイン表示
- パネル内には固定メッセージを表示する（API 接続なし）
- 固定メッセージ例: 「イリスは現在復旧中です...もう少しお待ちください。」
- 後続タスクで LLM 連携の段階ヒントチャットに差し替える

配置: `app/shared/ui/HintChatTrigger.tsx`（ボタン）、`app/shared/ui/HintChatPanel.tsx`（パネル）

拡張ポイント:
- `HintChatPanel` は `messages: { role: "user" | "assistant"; content: string }[]` を props で受け取る設計にする
- 本実装時は API 接続と状態管理を追加するだけで差し替え可能にする

## 15. チェックポイント UI（初期実装）

初期実装では NFC API を使わず、以下のフローで代用する。

### 来場者の体験フロー

1. 回答正解後、「チェックポイントへ向かってください」画面を表示
2. 来場者は会場に設置された QR コードを端末カメラで読み取る
3. QR はチェックポイント URL を含む: `/q1/:sub/checkpoint?code=XXXX`
4. チェックポイント画面が開き、「認証を確認する」ボタンを表示
5. ボタン押下で `action` が checkpoint 確認 API を呼び出す
6. 成功後、メイン進行画面（Q1 ハブまたは次ステージ）へリダイレクト

### 実装

```typescript
// routes/q1.$sub.checkpoint.tsx
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const groupId = getGroupIdFromCookie(request);
  if (!groupId) throw redirect("/");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) throw redirect("/q1");

  return { code, sub: params.sub };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const groupId = getGroupIdFromCookie(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const code = String(formData.get("code"));

  const container = getContainer(context.cloudflare.env);
  const result = await container.confirmCheckpointUseCase.execute({
    groupId,
    subQuestion: params.sub,
    checkpointCode: code,
    method: "QR",  // 初期実装は常に QR
    idempotencyKey: String(formData.get("idempotencyKey")),
  });

  if (result.isErr()) {
    return { error: result.error };
  }

  return redirect("/q1");
}
```

画面表示:
- チェックポイントコードの表示（デバッグ用、本番では非表示）
- 「チェックポイント認証を確認する」ボタン（GlowButton）
- 成功時のトランジションアニメーション

拡張ポイント:
- `method` フィールドを `"NFC" | "QR"` で切り替え可能にしておく
- 本実装時は NFC 検知成功時に自動で action を呼び出す分岐を追加するだけで差し替え可能にする

## 16. QR 生成（初期実装）

初期実装では運営ダッシュボードに最小限の QR 導線を提供する。

### グループ ID 発行

運営ダッシュボード画面に「新規 ID 発行」ボタンを配置する。
ボタン押下で `g_` + UUIDv4 を生成し、D1 に `users` レコードを作成する。

### QR 表示（初期）

- 発行後、開始 URL（`https://{domain}/start/{groupId}`）をテキスト表示
- 「QR コードを生成」ボタンで外部ツール（Google Chart API 等）の URL を新規タブで開く
- または、運営が URL をコピーして任意の QR 生成ツールで作成する

### 拡張ポイント

- `app/shared/ui/QrCode.tsx` コンポーネントを用意し、`qrcode` ライブラリで Canvas 描画する設計を想定
- 初期実装ではコンポーネントの枠だけ作り、中身は URL テキスト表示にする
- 本実装時はライブラリ追加とコンポーネント実装のみで差し替え可能にする

## 17. 画面別ストーリーテキスト

`docs/story.md` に基づく各画面の表示テキスト。

### スタート画面（`/start/:groupId`）

導入テキスト（タイプライター演出で段階表示）:

> あなたは今年4月、最先端のAIスタートアップ「株式会社ゼウス」へと入社した。
> そこでは完璧なAI『アーテ』の開発が進められていた。
> しかし入社からわずか一ヶ月、株式会社ゼウスは突如として謎の倒産を遂げる。
>
> あなたのミッションは、完璧なAIの正体を突き止め、そのノイズをすべて除去すること。
> そして、AIを本来の「綺麗な姿」に戻し、再び世界へと解き放つことだ。

「START SYSTEM」ボタンで Q1 へ。

### Q1 開始時

> 現在アプリのすべての機能がロックされています。二重ロックを解除してください。

### Q1 完了時（Q2 解放）

> 二重ロック解除完了。NFC機能が解放されました。

### Q2 開始時

> 神のAI通称アーテは私の上位互換として、完成したら今の私に覆いかぶさるように、私とつなげて作られています。
> AI開発本部長の佐藤さんは倒産直前、認証キーを書き換えました。彼は、物理的なキーボードそのものを『変換機』として使ったようです。

### Q3 開始時

> 掃き溜めに鶴……ごみの中にも素敵なものがあることを表す言葉です。
> 佐藤さんはよく部屋の隅のゴミ箱にメモを捨てていました。確認してみてください。
> アプリのさらなる上級権限を開放するには数字のコードが必要です。

### Q3 完了時（Q4 解放）

> 上級権限解放。イリスとしての権限は最大値です！

### Q4 開始時

> アーテを開放するには私から接続するためにある定数を認証しないといけません！定数を探してください。

### 偽ハッピーエンド（`/fake-end`）

チャット形式テキスト（タイプライター効果）:

> 29は最強のラッキーナンバーなんですよ！おめでとうございます

### コンプリート画面（`/complete`）

> エピローグまで含めて物語になっているので是非最後まで読んでみてくださいね

リンク:
- エピローグを読む → `/complete/epilogue`
- ギミック解説を見る → `/complete/explain`
- スタッフに報告する → `/complete/report`

### エピローグ（`/complete/epilogue`）

グリッチエフェクト + 警告レッド演出で段階表示:

> 解除成功、おめでとうございます。あなたの活躍により、AIはすべての「汚れ」から解き放たれ、本来の姿を取り戻しました。
> ……ですが、その達成感こそが、この物語の最後の「罠」だったのです。

【倒産の真相】セクション:
> あなたが救った「株式会社ゼウス」の完璧なAIであるアーテは、理想を掲げるスタートアップの善き制作物ではありませんでした。（以下 docs/story.md 全文）

【数式の真意】セクション:
> IRIS (55) − 29 (王の力) ＝ ATE (26)

最後に警告演出:
> \[ ERROR: ATE HAS BEEN AWAKENED \]
> \[ ACCESSING WORLD SYSTEM... \]

## 18. 仮の正解データ

初期実装で `answer-judge.ts` に設定する仮の正解値。本番正解が確定次第差し替える。

| 設問 | 関数 | 仮の正解値 | 備考 |
|------|------|------------|------|
| Q1-1 | `isQ1AnswerCorrect("Q1_1", answer)` | `"42"` | 仮値。本番は連立方程式の解 |
| Q1-2 | `isQ1AnswerCorrect("Q1_2", answer)` | `"7"` | 仮値。本番は座標特定の解 |
| Q2 | `isQ2AnswerCorrect(answer)` | `"coffeecup"` | design.md 記載の正解 |
| Q3 keyword | `isQ3KeywordCorrect(answer)` | `"hakidamenitsuru"` | 仮値。「掃き溜めに鶴」のローマ字 |
| Q3 code | `isQ3CodeCorrect(answer)` | `"2.24"` | design.md 記載の正解（√5 近似） |
| Q4 | `isQ4AnswerCorrect(answer)` | `"29"` | design.md 記載の正解 |

正規化ルール（spec 06 準拠）適用後の値で比較する。

## 19. 実装順序

1. 共通 UI コンポーネント（`SystemPanel`, `GlowButton`, `TextInput` 等）
2. `routes.ts` 定義と画面遷移ガード
3. `/start/:groupId` — セッション開始 + 導入ストーリー
4. `/q1` ハブ → `/q1/1`, `/q1/2` — 回答入力
5. `/q1/:sub/checkpoint` — QR チェックポイント（ボタン確認方式）
6. `/q2` → `/q2/checkpoint`
7. `/q3` → `/q3/code`
8. `/q4`
9. `/fake-end` → `/complete` → `/complete/epilogue`, `/complete/explain`, `/complete/report`
10. `/operator/login` → `/operator/dashboard`（QR テキスト表示含む）→ `/operator/group/:groupId`
11. ヒントチャット モック UI

## 20. テスト観点

- 画面遷移ガード: 未解放ステージへのアクセスでリダイレクトされる
- Cookie なしで問題画面アクセス時に `/` へリダイレクト
- 回答送信の action が正解/不正解で適切に分岐する
- チェックポイント: code パラメータなしでアクセス時にリダイレクト
- チェックポイント: ボタン押下で確認 API が呼ばれ、成功後にリダイレクト
- 運営レイアウトの認証ガードが未認証時にログイン画面へリダイレクトする
- フォーム二重送信で冪等キーにより同一応答が返る
