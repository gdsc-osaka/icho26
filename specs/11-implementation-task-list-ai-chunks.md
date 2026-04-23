# 11 実装タスク一覧（AI投入単位）

このドキュメントは、AI codingへ順番に投入する最小タスク単位を定義する。

## 1. 実装ステップ（依存順）

各 Step 内のタスクはすべて前の Step が完了してから着手する。
同一 Step 内で「並列可」と記載されたタスクは同時に進めてよい。

---

### Step 1: プロジェクト基盤

> 目的: ローカルで `pnpm dev` が Cloudflare Workers 環境で起動する状態にする

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 1 | Cloudflare Workers アダプター移行 | `12` | `feat/cloudflare-adapter` | - |

やること:
- `@react-router/node`, `@react-router/serve` 削除
- `@react-router/cloudflare`, `wrangler`, `@cloudflare/workers-types` 追加
- `wrangler.toml`, `.dev.vars` 作成
- `vite.config.ts` に `cloudflareDevProxy()` 追加
- `tsconfig.json` の types 変更
- `Dockerfile` 削除
- `pnpm dev` で起動確認

完了条件: `pnpm dev` でローカルサーバーが起動し、既存の home 画面が表示される

---

### Step 2: データ層 + 共通基盤

> 目的: D1 スキーマとアプリ共通基盤を確定し、API 実装の土台を作る

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 2 | D1 schema + migration + Drizzle 定義 | `05` | `feat/d1-schema` | 可 |
| 3 | 共通エラー型 + middleware | `04` | `feat/app-skeleton` | 可 |
| 4 | RequestId + 共通エラーレスポンス整備 | `04` | （#3 と同一ブランチ） | #3 の後 |

やること（#2）:
- `db/schema/` に全テーブル定義（users, logs 系 6 テーブル, idempotency, operator-auth, checkpoint）
- `db/migrations/0001_initial.sql` 生成
- `wrangler d1 execute --local` でローカル適用確認

やること（#3, #4）:
- `app/shared/errors/` に AppError, エラーコード定義
- `app/shared/result.ts` に Result 型
- `workers/bindings/env.ts` に AppEnv 型
- `app/composition.server.ts` スケルトン
- requestId 生成 middleware

完了条件: `pnpm build` が通る、ローカル D1 にテーブルが作成される

---

### Step 3: ドメイン + デザイン基盤

> 目的: 純粋ドメインロジックと UI 部品を並列で仕上げる

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 5 | 参加者 Domain（正規化/判定/遷移） | `06`, `13`§18 | `feat/participant-domain` | 可 |
| 6 | デザイントークン + フォント + root.tsx 更新 | `13`§11,§12 | `feat/design-tokens` | 可 |
| 7 | 共通 UI コンポーネント | `13`§7 | `feat/ui-components` | #6 の後 |

やること（#5）:
- `app/modules/progress/domain/` に state-machine, answer-normalizer, answer-judge
- 仮の正解データ（Q1-1:`"42"`, Q1-2:`"7"`, Q2:`"coffeecup"`, Q3kw:`"hakidamenitsuru"`, Q3code:`"2.24"`, Q4:`"29"`）
- 全遷移パターンの unit テスト

やること（#6, #7）:
- `app/app.css` にデザイントークン定義
- `root.tsx` を Space Grotesk + JetBrains Mono に変更、`lang="ja"`
- `app/shared/ui/` に SystemPanel, GlowButton, TextInput, ErrorAlert, LoadingOverlay, StageHeader, MonospaceLog

完了条件: Domain の unit テスト全パス、UI コンポーネントがストーリーブックまたは dev 画面で表示確認できる

---

### Step 4: 参加者 API

> 目的: 来場者向け API エンドポイントを全て実装する

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 8 | 参加者 API start/progress | `07` | `feat/participant-api-start` | - |
| 9 | 参加者 API answer/checkpoint | `07` | `feat/participant-api-answer` | #8 の後 |

やること（#8）:
- `app/modules/progress/application/usecases/` に start-session, get-progress
- `app/modules/progress/infrastructure/` に progress-repository.d1.server.ts
- composition.server.ts にusecase 登録
- integration テスト

やること（#9）:
- submit-answer, confirm-checkpoint, mark-epilogue-viewed usecase
- idempotency-repository.d1.server.ts
- checkpointCodes テーブル参照ロジック
- integration テスト（冪等、競合、チェックポイント検証）

完了条件: 全参加者 API が curl / テストで動作確認できる

---

### Step 5: 来場者画面

> 目的: 来場者が QR スキャンから complete まで一気通貫で遊べるようにする

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 10 | routes.ts + 画面遷移ガード + セッション Cookie | `13`§3,§4,§5 | `feat/participant-routes` | - |
| 11 | 来場者画面: start + Q1 ハブ + Q1-1/Q1-2 | `13`§17 | `feat/participant-q1` | #10 の後 |
| 12 | 来場者画面: Q1 checkpoint（QR ボタン方式） | `13`§15 | （#11 と同一ブランチ可） | #11 の後 |
| 13 | 来場者画面: Q2 + Q2 checkpoint | `13` | `feat/participant-q2` | #12 の後 |
| 14 | 来場者画面: Q3 + Q3 code | `13` | `feat/participant-q3` | #13 の後 |
| 15 | 来場者画面: Q4 | `13` | `feat/participant-q4` | #14 の後 |
| 16 | 来場者画面: fake-end + complete + epilogue + explain + report | `13`§17 | `feat/participant-ending` | #15 の後 |

やること（#10）:
- `app/routes.ts` に全ルート定義
- guardLoader ヘルパ（Cookie 取得 → 進捗チェック → リダイレクト）
- `group_session` Cookie の set/get ヘルパ

やること（#11〜#16）:
- 各画面の loader（ガード + データ取得）、action（回答送信）、UI
- `docs/story.md` のストーリーテキストを各画面に配置
- 冪等キー生成 hook（`useIdempotencyKey`）

完了条件: ブラウザで `/start/{groupId}` からQ1→Q2→Q3→Q4→fake-end→complete→epilogue まで通しで操作できる

---

### Step 6: 運営 API + 画面

> 目的: 運営がログインし、ダッシュボードでグループ管理できるようにする

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 17 | 運営 login/logout + session 検証 API | `08` | `feat/operator-auth` | - |
| 18 | 運営 dashboard/group 取得 API | `08`,`09` | `feat/operator-api` | #17 の後 |
| 19 | 運営 status-correction/mark-reported API | `08`,`09` | （#18 と同一ブランチ可） | #18 の後 |
| 20 | 運営画面: login + 認証ガード | `13`§6 | `feat/operator-ui` | #17 の後、並列可 |
| 21 | 運営画面: dashboard + group 詳細 | `13`§16 | （#20 と同一ブランチ可） | #18,#20 の後 |

やること（#17）:
- PBKDF2 検証、セッション発行/検証/失効
- operator-session-repository, operator-credential-repository
- Cookie 発行（HttpOnly, Secure, SameSite=Strict）

やること（#18, #19）:
- dashboard 一覧（cursor ページネーション）、group 詳細
- status-correction, mark-reported（state_version 楽観ロック + 監査ログ）

やること（#20, #21）:
- `/operator/login` 画面
- operator.tsx レイアウトの認証ガード
- ダッシュボード一覧テーブル + QR テキスト表示
- グループ詳細 + 補正操作フォーム

完了条件: 運営がログインし、グループ一覧表示・詳細確認・ステータス補正・報告済みマークが行える

---

### Step 7: KV キャッシュ + 非同期ジョブ

> 目的: パフォーマンス最適化とデータ保守の自動化

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 22 | KV 世代管理 + フォールバック | `09` | `feat/kv-cache` | - |
| 23 | 日次クリーンアップ Job | `09` | `feat/cleanup-job` | #22 の後 |

やること（#22）:
- `dash:version:v1` インクリメント（進捗更新/補正/報告時）
- ダッシュボード/グループ詳細の KV キャッシュ読み書き
- KV 障害時の D1 フォールバック
- 運営セッションの KV キャッシュ

やること（#23）:
- Cron Trigger 設定（`wrangler.toml` に追加）
- 30 日超過レコード削除（idempotency_keys, 全ログテーブル）

完了条件: KV キャッシュ hit でダッシュボードが高速化、Cron 実行で古いレコードが削除される

---

### Step 8: モック機能

> 目的: 本番未実装の機能をモックで埋め、体験フロー上の穴をなくす

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 24 | ヒントチャット モック UI | `13`§14 | `feat/hint-chat-mock` | - |

やること:
- `app/shared/ui/HintChatTrigger.tsx`（フローティングボタン）
- `app/shared/ui/HintChatPanel.tsx`（スライドインパネル、固定メッセージ表示）
- `messages` props 設計で後から LLM 差し替え可能にする

完了条件: 各問題画面でチャットボタンをタップしてモックパネルが開閉できる

---

### Step 9: Terraform + CI/CD

> 目的: 本番デプロイ可能な状態にする

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 25 | Terraform module 骨格 | `02`,`03` | `feat/terraform-modules` | 可 |
| 26 | envs/prod の plan 可能化 | `02`,`03` | （#25 と同一ブランチ可） | #25 の後 |
| 27 | CI（lint/type/unit/integration/tf plan） | `10` | `chore/ci-setup` | 可 |
| 28 | deploy workflow（prod 手動承認） | `10` | `chore/deploy-workflow` | #26,#27 の後 |

完了条件: `terraform plan` が通る、PR で CI が自動実行される、手動承認でデプロイできる

---

### Step 10: 品質・受け入れ

> 目的: 本番品質を検証する

| # | タスク | spec | ブランチ例 | 並列 |
|---|--------|------|-----------|------|
| 29 | E2E 主要シナリオ | `10` | `feat/e2e-tests` | - |
| 30 | 非機能 SLO 計測 + 監視 | `10` | `chore/monitoring` | #29 の後 |
| 31 | モバイル実機受け入れ | `10` | （手動実施） | #30 の後 |

完了条件: E2E で開始→完走導線が自動検証される、p95 レイテンシが SLO 内、実機で操作可能

---

## 2. 依存関係図

```
Step 1  [#1 Workers移行]
   ↓
Step 2  [#2 D1 schema] ─────────┬─── [#3,#4 エラー型/middleware]
   ↓                            ↓
Step 3  [#5 Domain] ──┬── [#6 デザイン] → [#7 UIコンポーネント]
                      ↓         ↓
Step 4  [#8 API start] → [#9 API answer]
                      ↓         ↓
Step 5  [#10 routes/ガード] → [#11〜#16 来場者画面]
                                ↓
Step 6  [#17 運営auth] → [#18,#19 運営API] → [#20,#21 運営画面]
                                ↓
Step 7  [#22 KV] → [#23 Cleanup]
                                ↓
Step 8  [#24 チャットモック]     (任意タイミング、#7 以降いつでも可)
                                ↓
Step 9  [#25,#26 Terraform] → [#27 CI] → [#28 deploy]
                                ↓
Step 10 [#29 E2E] → [#30 監視] → [#31 実機]
```

## 3. 1タスクの投入サイズ目安

- 変更ファイル: 3〜8ファイル
- 追加コード: 150〜350行
- テスト: 最低1ファイル追加
- 1PRに複数ドメインを混在させない

## 4. AIに渡す指示テンプレート（短文）

以下を毎回貼る:

- 対象仕様: `specs/xx-...md`
- 守る前提: 仕様を変更しない
- 変更範囲: 対象レイヤのみ
- 必須: テスト追加、型エラー0
- 禁止: D1/KV責務違反、ルートに業務ロジック直書き

## 5. レビュー観点（最小）

- `CONFLICT_STATE` を正しく返しているか
- idempotencyが更新系全APIで強制されているか
- `state_version` 条件付き更新が漏れていないか
- KV障害でもD1正データで継続できるか
- 画面遷移ガードが全ルートで適用されているか
- チェックポイントコード検証が正しく動作するか
- ストーリーテキストが `docs/story.md` と一致しているか
