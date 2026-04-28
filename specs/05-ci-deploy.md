# 05 インフラ・CI・デプロイ

依存: `00-architecture.md`, `01-data-model.md`

このドキュメントは Terraform による Cloudflare リソース管理、GitHub Actions による CI、`wrangler deploy` による本番反映を定義する。

## 1. リソース構成

| リソース | 名前(例) | 管理 |
|---|---|---|
| Cloudflare Worker | `icho26` | コード = `wrangler deploy` / 設定 = `wrangler.toml` |
| D1 Database | `icho26-prod` | **Terraform** で作成、ID を `wrangler.toml` に記述 |
| KV Namespace | `icho26-cache` | **Terraform** で作成、ID を `wrangler.toml` に記述 |

`wrangler.toml` の `database_id` / `id` は Terraform の `output` から取得した実値を記述する(秘匿情報ではないので公開コミット可)。

## 1.1 Terraform でのインフラ管理

### 管理対象

- Cloudflare D1 Database
- Cloudflare Workers KV Namespace
- 必要に応じて: Worker のカスタムドメインルーティング(独自ドメイン運用時)

Worker のコード自体は `wrangler deploy` で管理し、Terraform では扱わない。コード変更のたびに `terraform apply` を走らせる必要がない設計とする。

### ディレクトリ

```
terraform/
├── main.tf         # provider + リソース定義
├── outputs.tf      # D1/KV ID を出力(wrangler.toml にコピーする値)
├── variables.tf    # account_id 等の入力変数
└── .terraform.lock.hcl
```

### プロバイダ

- `cloudflare/cloudflare ~> 4.x`
- 認証は `CLOUDFLARE_API_TOKEN`(環境変数 `TF_VAR_cloudflare_api_token`)

### 状態管理

- 単一環境(prod のみ)前提のため、リモートバックエンドは採用しない
- `terraform.tfstate` はローカルに保持し、`.gitignore` で Git から除外する
- 構築時の `terraform apply` は GDGoC Osaka 運営メンバーが手動で実行する
- 既存リソースを再構築する必要が出た場合は `terraform import` で取り込む

### 適用フロー(初回構築)

1. `terraform/` で `terraform init`
2. `terraform plan` で差分確認
3. `terraform apply` で D1 / KV を作成
4. `terraform output` で表示される ID を `wrangler.toml` に転記
5. `wrangler.toml` をコミット
6. 以降のコード変更は `wrangler deploy`(`05.4` に従う)

リソース追加・変更は同様の手順で都度実施する。

### CI 連携

Terraform は CI で自動化しない。理由:

- 変更頻度が極めて低い(初回構築 + 数回の追加程度)
- 状態ファイルがローカル保持のため、CI から扱うと runners 間で整合性が取れない
- 手動 apply で十分追える規模

将来的に頻度が上がった場合は R2 バックエンド + GitHub Actions 自動 apply への移行を検討する。

## 2. シークレット

GitHub Actions と Cloudflare Workers の両方で必要なシークレット:

| 名前 | 場所 | 用途 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Actions Secrets | `wrangler deploy` の認証 |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions Secrets / `wrangler.toml` | Cloudflare アカウント識別 |
| `SESSION_SIGNING_KEY` | Cloudflare Workers Secret(`wrangler secret put`) | 将来 Cookie 署名導入時用に確保 |

ローカル開発用は `.dev.vars` に同名で持つ(既存の `.dev.vars` 参照)。

## 3. ブランチ戦略

`CLAUDE.md` の規約に従う:

- `main` を deployable に保つ
- 作業は `feat/` / `fix/` / `chore/` プレフィックスのブランチで行い、PR 経由で squash merge
- 本番デプロイは `main` への merge をトリガーとする

## 4. GitHub Actions ワークフロー

### 4.1 `ci.yml`(PR 時)

PR が open / synchronize された時に実行する。

ステップ:
1. `actions/checkout@v4`
2. Node.js セットアップ(`actions/setup-node@v4`、`package.json` の `engines` に従う)
3. `pnpm install --frozen-lockfile`
4. `pnpm typecheck`
5. `pnpm test`(Vitest)
6. `pnpm build`(react-router build がエラーなく通ることの確認)

Wrangler の認証情報はこの段階では不要。

### 4.2 `deploy.yml`(main push 時)

`main` ブランチへの push をトリガーとする。`workflow_dispatch` も併せて許可する(手動実行用)。

ステップ:
1. CI と同じ build まで実行
2. D1 マイグレーション適用: `wrangler d1 migrations apply icho26-prod --remote`
3. Worker デプロイ: `wrangler deploy`
4. デプロイ後の smoke check(`curl https://<domain>/` で 200)

`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を環境変数として渡す。

ロールバックは Cloudflare ダッシュボードの Versions 画面から直前バージョンを再公開する手動操作で行う。

## 5. データベースマイグレーション運用

- ローカル: `wrangler d1 migrations apply icho26-prod --local`
- 本番: `deploy.yml` の中で `--remote` 付きで実行
- スキーマ変更は `pnpm db:generate` で生成し、`db/migrations/` にコミットする
- 既存マイグレーションファイルは編集せず、連番で新規ファイルを追加する
- 破壊的変更は禁止。カラム追加・テーブル追加で対応する

## 6. シード投入

初回デプロイ時のみ手動実行する:

1. 運営パスワードハッシュ生成スクリプト(`db/seed/operator.ts`)で `operator_credentials` の 1 行を作成
2. `wrangler d1 execute icho26-prod --remote --file=db/seed/operator.sql` 等で投入
3. checkpoint コードも同様に手動投入

スクリプトの正確な形は実装時に決める。本ドキュメントは「自動化しない、手順を残す」方針のみ示す。

## 7. テスト構成

- **unit**: `tests/lib/**/*.test.ts`
  - `participant/normalize` の正規化ルール
  - `participant/transitions` の各状態遷移
  - `operator/password` の hash / verify 往復
- **integration**: 必要に応じて Vitest + Miniflare で loader / action を直接呼ぶ
- **e2e**: 自動化しない。`pnpm dev` でのローカル手動確認をリリース前チェックとする

CI で実行するのは unit + integration のみ。

## 8. 受け入れチェック(手動、リリース前)

- [ ] `/start/:groupId` で開始 → `/q1` 到達
- [ ] Q1 サブ問題ランダム順序が固定される(再開で再抽選されない)
- [ ] 全問正解で `/fake-end` → `/complete` → `/complete/epilogue` まで到達
- [ ] `/operator/login` でログイン成功 → ダッシュボード表示
- [ ] 新規 ID 発行 → コピーした URL でセッション開始
- [ ] グループ詳細でステータス補正 + 報告済み付与が反映される
- [ ] モバイル実機(縦持ち)で主要画面が崩れない

## 9. 監視 / ロギング

- 詳細な監視基盤は構築しない
- 障害発生時は Cloudflare ダッシュボードの Workers Logs を直接確認する
- 必要に応じて `console.error` を活用し、エラー時に request id とコンテキストを出力する
