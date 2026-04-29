# 06 実装タスク一覧

依存: `00-architecture.md`, `01-data-model.md`, `02-ui-design-foundation.md`, `03-participant-feature.md`, `04-operator-feature.md`, `05-ci-deploy.md`

このドキュメントは AI 投入単位の実装ロードマップを定義する。各 Step は依存関係順に並べ、原則として **feature 単位の vertical slice**(BE + UI を 1 つの Step で完結)で進める。

## 既に完了している項目

以下は `chore/rewrite-specs` 時点で既に完了しているため、本ロードマップの対象外。

- React Router v7 framework mode のセットアップ
- Cloudflare Workers アダプタ(`vite.config.ts` の `cloudflareDevProxy`、`wrangler.toml`、`.dev.vars`)
- TypeScript / Tailwind CSS v4 / Drizzle Kit / Vitest の設定ファイル
- `package.json` の scripts(`dev` / `build` / `typecheck` / `test` / `db:generate`)

これらの再構築タスクは Step に含めない。

## ロードマップ概要

```
Step 1: 共通基盤(DB スキーマ + デザイン基盤)
   ↓
Step 2: 参加者 vertical slice — 開始 + Q1
   ↓
Step 3: 参加者 vertical slice — Q2 〜 Q4
   ↓
Step 4: 参加者 vertical slice — 偽エンド + 終盤
   ↓
Step 5: 運営者 vertical slice — 認証 + ダッシュボード
   ↓
Step 6: 運営者 vertical slice — グループ詳細 + 介入操作
   ↓
Step 7: CI + 本番デプロイ整備
```

各 Step は `feat/` プレフィックスのブランチを切り、PR で merge する(`CLAUDE.md` の規約)。

---

## Step 1: 共通基盤

> 目的: 全 feature が依存する DB スキーマと UI デザイン基盤を一括で揃える

参照: `01-data-model.md`、`02-ui-design-foundation.md`

ブランチ例: `feat/foundation`

### 作業

1. `db/schema/*.ts` に全テーブルを定義(`users`、`attempt_logs`、`progress_logs`、`checkpoint_codes`、`operator_credentials`、`operator_sessions`、`operator_actions`)
2. `db/schema/index.ts` で集約 export(enum 定数も併せて export)
3. `pnpm db:generate` で `db/migrations/0001_initial.sql` を生成
4. `wrangler d1 execute --local` でローカル D1 にスキーマ適用、テーブル作成を確認
5. `app/app.css` にデザイントークンを `@theme` で定義
6. `app/root.tsx` に Google Fonts(Space Grotesk + JetBrains Mono)の `links` を追加、`lang="ja"` を設定
7. `app/components/` に共通 atoms(`SystemPanel`、`GlowButton`、`TextInput`、`ErrorAlert`、`LoadingOverlay`、`StageHeader`、`MonospaceLog`)を作成
8. `app/components/index.ts` で集約 export

### 完了条件

- `pnpm typecheck` が通る
- `pnpm build` が通る
- ローカル D1 に全テーブルが作成されている
- `app/components/` の各 atom がインポートして表示できる(動作確認用に `routes/home.tsx` を一時的に使ってよい)

---

## Step 2: 参加者 — 開始 + Q1

> 目的: 来場者が QR から始めて Q1 を完走できる最小フロー

参照: `03-participant-feature.md` §2(`/`、`/start/:groupId`、`/q1`、`/q1/1`、`/q1/2`、`/q1/:sub/checkpoint`)

ブランチ例: `feat/participant-q1`

### 作業

1. `app/lib/participant/types.ts` に `Stage`、`SubQuestion`、`Q1Order`、`UserRow` 等を定義
2. `app/lib/participant/normalize.ts` を実装、unit テスト追加
3. `app/lib/participant/judge.ts` に仮の正解値テーブルと `isCorrect` を実装、unit テスト追加
4. `app/lib/participant/transitions.ts` に `startOrResume` / `applyQ1Answer` / `applyQ1Checkpoint` を実装、unit テスト(順序固定 + 未解放サブ拒否 + 回答 only では未完了)
5. `app/lib/participant/session.ts` に Cookie 操作と `requireParticipant` ヘルパを実装
6. `app/lib/participant/queries.ts` / `mutations.ts` に必要な関数を実装
7. `app/routes/home.tsx` を最終仕様に書き換え(QR 未読時の案内のプレースホルダで可)
8. `routes/start.$groupId.tsx`、`routes/q1.tsx`、`routes/q1.1.tsx`、`routes/q1.2.tsx`、`routes/q1.$sub.checkpoint.tsx` を実装
9. `app/routes.ts` に上記ルートを登録
10. ストーリーテキスト(`docs/story.md` 参照)を Q1 開始・完了で表示

### 前提セットアップ

- `db/seed/checkpoint-codes.sql` は **先行タスク(`feat/seed-checkpoint-codes`)で実装済み**。Step 2 では新規作成しない
- ローカル動作確認時は以下のコマンドで投入してから checkpoint テストを行う

  ```bash
  wrangler d1 execute <database-name> --local --file=db/seed/checkpoint-codes.sql
  ```

### 完了条件

- ローカルで QR(または直リンク)から `/start/:groupId` を開いて開始できる
- Q1 のサブ問題が `q1Order` に従って正しい順序で表示される
- 回答正解後 → checkpoint → 次のサブ問題 → 両方完了で `/q2` へ進む(まだ `/q2` ルートはないので 404 でよい、`current_stage = Q2` まで遷移できれば OK)
- unit テストが Q1 関連の遷移仕様をカバー

---

## Step 3: 参加者 — Q2 〜 Q4

> 目的: 中盤・後半の問題を実装し、`FAKE_END` 直前まで到達可能にする

参照: `03-participant-feature.md` §2(`/q2`、`/q2/checkpoint`、`/q3`、`/q3/code`、`/q4`)

ブランチ例: `feat/participant-q2-q4`

### 作業

1. `transitions.ts` に Q2 / Q3 / Q4 の遷移関数を追加、unit テスト
2. `routes/q2.tsx`、`routes/q2.checkpoint.tsx`、`routes/q3.tsx`、`routes/q3.code.tsx`、`routes/q4.tsx` を実装
3. `routes.ts` を更新
4. ストーリーテキスト(Q2 / Q3 / Q4 の開始・完了)を配置

### 完了条件

- Q1 完走後、Q2 → Q3(keyword + code) → Q4 を全部正解で抜けられる
- Q4 正解で `current_stage = FAKE_END` に遷移する
- unit テストが Q2-Q4 の遷移仕様をカバー

---

## Step 4: 参加者 — 偽エンド + コンプリート + エピローグ

> 目的: 体験を最後まで完走できる状態にする

参照: `03-participant-feature.md` §2(`/release`、`/complete`、`/complete/epilogue`、`/complete/explain`、`/complete/report`)

ブランチ例: `feat/participant-end-flow`

### 作業

1. `transitions.ts` に `markEpilogueViewed` を追加、unit テスト
2. `routes/release.tsx`(`/release`、タイプライター演出。URL でネタバレしないよう `fake-end` ではなく `release` を採用)
3. `routes/complete.tsx`(エピローグ・解説・報告へのリンクハブ)
4. `routes/complete.epilogue.tsx`(`docs/story.md` のエピローグ全文 + グリッチ演出 + 警告色フラッシュ)
5. `routes/complete.explain.tsx`(ギミック解説のプレースホルダ。本番テキストは別途確定)
6. `routes/complete.report.tsx`(スタッフ報告提示画面、運営側で「報告済」を付与する流れの起点)
7. ヒントチャットモック(`app/components/hint-chat.tsx`)を全 Q ルートに配置

### 完了条件

- `FAKE_END` 到達後、`/release` → `/complete` → `/complete/epilogue` で `epilogue_viewed_at` がセットされる
- エピローグ閲覧前は `markEpilogueViewed` が拒否される(unit)
- 全画面が縦持ちスマホで崩れない(手動確認)

---

## Step 5: 運営者 — 認証 + ダッシュボード閲覧

> 目的: 運営がログインして全グループの進捗を見られる状態にする

参照: `04-operator-feature.md` §2(`/operator/login`、`/operator/dashboard`)

ブランチ例: `feat/operator-auth`

### 作業

1. `app/lib/operator/password.ts` を実装、unit テスト(hash → verify 往復)
2. `app/lib/operator/session.ts` に Cookie 操作と `verifySession` を実装
3. `app/lib/operator/auth.ts` にログイン処理を実装
4. `app/lib/operator/queries.ts` に `listUsers` を実装
5. `app/lib/operator/mutations.ts` に `createSession` / `revokeSession` / `createUser` を実装
6. `routes/operator.login.tsx` を実装(ログイン form + ログアウト用 action 同居)
7. `routes/operator.tsx`(レイアウト + 認証ガード loader)
8. `routes/operator.dashboard.tsx`(一覧表示 + 新規 ID 発行)
9. `routes.ts` に運営ルートを登録
10. seed スクリプト(運営パスワードハッシュ)を `db/seed/operator.sql` に追加。`checkpoint_codes` 用 `db/seed/checkpoint-codes.sql` は **先行タスク(`feat/seed-checkpoint-codes`)で実装済みのため Step 5 の対象外**

### 完了条件

- ログイン成功で `/operator/dashboard` に遷移、未認証時は `/operator/login` にリダイレクト
- ダッシュボードに既存グループ一覧が表示される
- 「新規 ID 発行」ボタンで `g_<UUID>` の `users` レコードが作成される
- ログアウトで Cookie が削除され、再アクセスで `/operator/login` に戻る

---

## Step 6: 運営者 — グループ詳細 + 介入操作

> 目的: ステータス補正と報告済み付与を実装し、当日運用に必要な救済機能を揃える

参照: `04-operator-feature.md` §2(`/operator/group/:groupId`)

ブランチ例: `feat/operator-intervention`

### 作業

1. `app/lib/operator/queries.ts` に `getUserDetail` を追加
2. `app/lib/operator/mutations.ts` に `correctStatus` / `markReported` を追加
3. `routes/operator.group.$groupId.tsx` を実装(詳細表示 + 補正フォーム + 報告済みボタン)
4. 監査ログの表示(運営の過去操作履歴)

### 完了条件

- ステータス補正で `users.current_stage` と `operator_actions` が両方更新される(integration テスト)
- 報告済み付与で `users.reported_at` が更新される
- 補正前後の値が監査ログに記録される
- 操作はトランザクション内で実行される(片方だけ成功するケースがない)

---

## Step 7: インフラ + CI + 本番デプロイ整備

> 目的: Cloudflare Workers Builds で本番デプロイを自動化し、Terraform で D1 / KV を IaC 管理し、PR トリガーの軽量 CI を整備する

参照: `05-ci-deploy.md`

ブランチ例: `feat/infra-ci-deploy`

### 既に完了している項目

以下は Step 7 着手前の小修正 PR で完了済みなので Step 7 の対象外:

- 本番 D1 / KV のリソース作成(`pnpm wrangler d1 create` / `pnpm wrangler kv namespace create` で作成、ID を `wrangler.toml` に記述済み)
- Worker entry の修正(`workers/app.ts` に `createRequestHandler` ラッパ、`virtual:react-router/server-build` の wrangler `[alias]` 設定、`import.meta.env` フォールバック)
- ESLint + Prettier 導入(`chore/lint-format`)
- README 整備 + `postinstall` で `wrangler types` 自動実行(`chore/readme-postinstall`)
- Workers Builds の GitHub 連携設定(GUI で実施済み、main への push で自動 deploy 動作確認済み)

### 作業

1. **`.github/workflows/ci.yml` 作成**(PR トリガー)
   - lint / format:check / typecheck / test を実行
   - Cloudflare 認証情報は不要(API を叩かない)
   - 詳細は `05-ci-deploy.md` §5
2. **Terraform 設定の追加**(`terraform/`)
   - `main.tf`: cloudflare provider + D1 + KV namespace リソース
   - `variables.tf`: `account_id` / `cloudflare_api_token`(後者は `TF_VAR_` env 経由)
   - `outputs.tf`: D1 / KV ID(参照用)
   - `terraform.tfvars.example`: 入力変数の雛形
   - `.gitignore` に `terraform/.terraform/`、`terraform/terraform.tfstate*`、`terraform/terraform.tfvars` を追加
3. **既存リソースの import**(手動、運営メンバー側で実施)
   - `terraform init`
   - `terraform import cloudflare_d1_database.icho26 <ACCOUNT_ID>/<D1_ID>`
   - `terraform import cloudflare_workers_kv_namespace.cache <ACCOUNT_ID>/<KV_ID>`
   - `terraform plan` で差分なしを確認
4. **README に手順追記**(Workers Builds 接続 + Terraform セットアップ)
5. **本番 seed 投入**(`05-ci-deploy.md` §8)
   - `db/seed/generate-operator-credentials.mjs` で本番運営パスワードを投入
   - 本番 checkpoint コードは推測困難な値を別途生成して投入
6. **受け入れチェックリスト**(`05-ci-deploy.md` §10)を実機で実施

### 完了条件

- PR で CI が green になる(lint / format / typecheck / test 全て通る)
- `terraform plan` が import 後に差分なし(冪等性確認)
- README の手順通りに新規メンバーが Terraform import + Workers Builds 接続を再現できる
- 本番 URL で開始 → 完走 → 運営ダッシュボード操作の主要フローが動く

---

## 仕様変更時の運用

実装中に仕様を変更する場合は、該当する 01〜05 の spec を先に更新してから実装する。本ドキュメント(06)の Step 単位を超える変更が出た場合は、Step を分割または追加する。
