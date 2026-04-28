# Open issues

このプロジェクトで把握している未実施事項・後続対応を集約する。エントリが解消したら該当節を削除する。

各エントリは以下の形式で記述する。

- **状態**: 未実装 / 部分実装 / 既知の不完全状態 / 設計検討中
- **背景**: なぜ今残っているか
- **解決策**: どこ(どの Step / 別タスク)で解消する想定か
- **影響**: 残したままで何が不便か

---

## Step 5(運営者 認証 + ダッシュボード)由来

### `verifySession` の integration test

- **状態**: 未実装
- **背景**: spec 04 §13 では unit 区分だが、Drizzle の chained API を実 D1 なしで純粋検証するのが難しい
- **解決策**: Miniflare + 実 sqlite ベースの integration test を別 PR で追加する
- **影響**: 失効セッションが本当に拒否されるかを自動検証していない。当面は手動 QA で代替する

### Step 5 のローカルスモーク確認(D1 投入 + 実ログイン)

- **状態**: 未実施
- **背景**: `wrangler.toml` の `database_id` がプレースホルダ(`00000000-...`)のままなため、`wrangler d1 execute --local` の挙動が環境依存になりうる
- **解決策**: Step 7(Terraform で D1/KV を作成)で実 ID を設定後にスモーク確認する。または開発者個別の `.dev.vars` で local D1 ID を上書きする運用を検討
- **影響**: 自動 smoke は CI でビルドが通る範囲のみ。ログイン動作は手動確認が必要

---

## Step 6(運営者 グループ詳細 + 介入)由来

### `correctStatus` / `markReported` の integration test

- **状態**: 未実装
- **背景**: spec 04 §13 では integration 区分。`db.batch` での atomic 実行(users + operator_actions + progress_logs)を実 D1 なしで検証しづらい
- **解決策**: Miniflare + 実 sqlite ベースの integration test を別 PR で追加する。`verifySession` テスト と同じ仕組みで一括整備するのが望ましい
- **影響**: 「片方だけ成功するケースがない」というトランザクション一貫性が自動検証できていない。当面は手動 QA で代替する

### Step 6 のローカルスモーク確認(補正・報告操作)

- **状態**: 未実施
- **背景**: Step 5 と同じ理由(D1 placeholder ID)で実機確認していない
- **解決策**: Step 7 解消後、実 D1 上で「補正前後の値が監査ログに残る」ことと「報告済み付与で reported_at が立つ」ことを確認する
- **影響**: ステータス補正と報告済み付与のロジックは手動 QA 待ち

---

## Step 1(共通基盤)由来

### `wrangler.toml` の D1 / KV ID プレースホルダ

- **状態**: プレースホルダ値のまま
- **背景**: 実 ID は Terraform から取得して埋める設計(spec 05 §1)
- **解決策**: Step 7 で `terraform apply` 後、`terraform output` の値を `wrangler.toml` に転記
- **影響**: 本番デプロイ前に必須。ローカル開発でも実 ID または `--local` D1 の自動作成名でしのぐ必要がある
