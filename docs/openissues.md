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

### `/operator/group/:groupId` 詳細リンクが 404

- **状態**: 既知の不完全状態
- **背景**: ダッシュボードの「詳細」リンクは Step 6 で実装するルートを指している
- **解決策**: Step 6(`feat/operator-intervention`)実装で解消
- **影響**: Step 5 単独で検証するときは「詳細」リンクが 404 になる

---

## Step 1(共通基盤)由来

### `wrangler.toml` の D1 / KV ID プレースホルダ

- **状態**: プレースホルダ値のまま
- **背景**: 実 ID は Terraform から取得して埋める設計(spec 05 §1)
- **解決策**: Step 7 で `terraform apply` 後、`terraform output` の値を `wrangler.toml` に転記
- **影響**: 本番デプロイ前に必須。ローカル開発でも実 ID または `--local` D1 の自動作成名でしのぐ必要がある
