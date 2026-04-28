# Open issues

このプロジェクトで把握している未実施事項・後続対応を集約する。エントリが解消したら該当節を削除する。

各エントリは以下の形式で記述する。

- **状態**: 未実装 / 部分実装 / 既知の不完全状態 / 設計検討中
- **背景**: なぜ今残っているか
- **解決策**: どこ(どの Step / 別タスク)で解消する想定か
- **影響**: 残したままで何が不便か

---

## 運営者 feature(Step 5 / 6)由来

### `verifySession` / `correctStatus` / `markReported` の integration test

- **状態**: 未実装
- **背景**: spec 04 §13 では unit / integration 区分。Drizzle の chained API と `db.batch` の atomic 実行を実 D1 なしで純粋検証するのが難しい
- **解決策**: Miniflare + 実 sqlite ベースの integration test を別 PR で一括整備する
- **影響**: 失効セッションの拒否、`correctStatus` 失敗時のロールバック等が自動検証できていない。手動 QA(Step 5/6 PR でのローカル smoke)で代替済みだが、回帰防止には未対応

---

## Step 1(共通基盤)由来

### `wrangler.toml` の D1 / KV ID プレースホルダ

- **状態**: プレースホルダ値のまま
- **背景**: 実 ID は Terraform から取得して埋める設計(spec 05 §1)
- **解決策**: Step 7 で `terraform apply` 後、`terraform output` の値を `wrangler.toml` に転記
- **影響**: 本番デプロイ時のみ必須。ローカル開発は `wrangler d1 execute --local` がプレースホルダ ID でも sqlite ファイルを作成して動作することを Step 5/6 の smoke で確認済み
