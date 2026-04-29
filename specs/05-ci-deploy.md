# 05 インフラ・CI・デプロイ

依存: `00-architecture.md`, `01-data-model.md`

このドキュメントは Cloudflare リソース管理(Terraform)、PR 時の CI(GitHub Actions)、本番デプロイ(Cloudflare Workers Builds)を定義する。

## 1. リソース構成

| リソース | 名前 | 管理 |
|---|---|---|
| Cloudflare Worker | `icho26` | コード = Workers Builds(GitHub 連携)で自動 deploy / 設定 = `wrangler.toml` |
| D1 Database | `icho26` | Terraform で管理。実 ID は `wrangler.toml` にコミット |
| KV Namespace | `icho26-cache` | Terraform で管理。実 ID は `wrangler.toml` にコミット |

`wrangler.toml` の `database_id` / `id` は秘匿情報ではないので公開コミット可。

## 2. Terraform でのインフラ管理

### 2.1 管理対象

- Cloudflare D1 Database
- Cloudflare Workers KV Namespace
- 必要に応じて: Worker のカスタムドメインルーティング(独自ドメイン運用時)

Worker 自体のコード・バインディングは Workers Builds + `wrangler.toml` で管理し、Terraform では扱わない。コード変更のたびに `terraform apply` を走らせる必要がない設計とする。

### 2.2 ディレクトリ

```
terraform/
├── main.tf               # provider + リソース定義
├── outputs.tf            # D1/KV ID を出力(参照用)
├── variables.tf          # account_id 等の入力変数
├── terraform.tfvars.example  # 入力変数の例(account_id のみ)
└── .terraform.lock.hcl
```

`terraform.tfvars`(実値が入る)と `terraform.tfstate` は **`.gitignore` 対象**。

### 2.3 プロバイダ

- `cloudflare/cloudflare ~> 4.x`
- 認証は `CLOUDFLARE_API_TOKEN`(環境変数 `TF_VAR_cloudflare_api_token`)

API Token の権限要件:
- Account / D1 — Edit
- Account / Workers KV Storage — Edit
- Account / Account Settings — Read

### 2.4 状態管理

- 単一環境(prod のみ)前提のため、リモートバックエンドは採用しない
- `terraform.tfstate` はローカルに保持し、`.gitignore` で Git から除外
- 構築・追加変更時の `terraform apply` は GDGoC Osaka 運営メンバーが手動で実行

### 2.5 既存リソースの取り込み(初回のみ)

D1 と KV namespace は CLI(`wrangler d1 create` / `wrangler kv namespace create`)で先行作成済み。Terraform は `terraform import` で既存リソースを state に取り込んだあと管理を引き継ぐ:

```sh
cd terraform
terraform init
terraform import cloudflare_d1_database.icho26 <ACCOUNT_ID>/<D1_ID>
terraform import cloudflare_workers_kv_namespace.cache <ACCOUNT_ID>/<KV_ID>
terraform plan   # 差分が出ないことを確認
```

新規環境を立てる場合は `terraform apply` で作成 → 出力された ID を `wrangler.toml` に転記。

### 2.6 CI 連携

Terraform は CI で自動化しない。理由:

- 変更頻度が極めて低い
- 状態ファイルがローカル保持のため CI runners と整合が取れない
- 手動 apply で十分追える規模

将来的に頻度が上がった場合は R2 バックエンド + GHA 自動 apply への移行を検討する。

## 3. シークレット

| 名前 | 場所 | 用途 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | **ローカル `.env` のみ**(コミット不可) | Terraform 実行時の `TF_VAR_cloudflare_api_token` |
| `SESSION_SIGNING_KEY` | Cloudflare Workers Secret(`wrangler secret put`) | 将来 Cookie 署名導入時用 |

GitHub Secrets には何も登録しない。Workers Builds は GitHub App 経由で Cloudflare に認証されるため Token 不要、CI(下記 §5)も Cloudflare API を叩かないため不要。

ローカル開発用の値は `.dev.vars` に保持する(既存)。

## 4. ブランチ戦略

`CLAUDE.md` の規約に従う:

- `main` を deployable に保つ
- 作業は `feat/` / `fix/` / `chore/` プレフィックスのブランチで行い、PR 経由で squash merge
- 本番デプロイは `main` への merge を Workers Builds が検知して自動実行

## 5. CI ワークフロー(`.github/workflows/ci.yml`)

PR の open / synchronize で実行する静的検査のみ。Cloudflare API には触れない。

ステップ:

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`(`package.json` の `packageManager` に従う)
3. `actions/setup-node@v4`(Node 22、pnpm キャッシュ有効)
4. `pnpm install --frozen-lockfile`(postinstall で `wrangler types` も自動実行)
5. `pnpm lint`
6. `pnpm format:check`
7. `pnpm typecheck`
8. `pnpm test`

すべて成功すれば PR の status check が green。`pnpm build` は Workers Builds 側の preview deploy に任せる(二重ビルドを避ける)。

## 6. 本番デプロイ(Workers Builds)

main への push を検知して Cloudflare Workers Builds が自動デプロイする。PR ごとに preview deploy も生成される。

### 6.1 初回セットアップ(GUI、一度だけ)

1. Cloudflare dashboard → Workers & Pages → 対象 Worker → Settings → "Connect to Git"
2. GitHub アカウント連携(Cloudflare GitHub App をリポジトリに認可)
3. Repository: `gdsc-osaka/icho26`、Branch: `main`
4. Build configuration:
   - Build command: `pnpm install && pnpm build`
   - Deploy command: `pnpm wrangler deploy`(Cloudflare 側のデフォルト)
   - Root directory: `/`
5. PR preview deployments を有効化

### 6.2 Worker entry

`wrangler.toml` の `main = "workers/app.ts"` が Worker entry。`workers/app.ts` は SSR バンドル(`virtual:react-router/server-build`、wrangler では `[alias]` で `./build/server/index.js` に解決)を `createRequestHandler` でラップしたもの。

### 6.3 ロールバック

Cloudflare dashboard → Workers & Pages → Versions から直前バージョンを再公開する手動操作。

## 7. データベースマイグレーション運用

- ローカル: `pnpm wrangler d1 migrations apply icho26 --local`
- 本番: `pnpm wrangler d1 migrations apply icho26 --remote`(初回 + スキーマ変更時に **手動実行**)
- スキーマ変更は `pnpm db:generate` で migration を生成し `db/migrations/` にコミット
- 既存 migration ファイルは編集せず連番で追加
- 破壊的変更は禁止(カラム追加・テーブル追加で対応)

Workers Builds の build pipeline には migration apply を含めない(誤適用リスクを避ける)。

## 8. シード投入

初回デプロイ時のみ手動実行する。

### 8.1 運営パスワード

```sh
node db/seed/generate-operator-credentials.mjs '<chosen-password>' \
  | pnpm wrangler d1 execute icho26 --remote --command -
```

パスワードは out-of-band で運営メンバーに共有する(コミットしない)。

### 8.2 checkpoint コード

開発用ダミー(`cp_q*_dev`)はそのまま本番に流さない。本番は推測困難な値に差し替えてから `db/seed/checkpoint-codes.sql` 相当を作成し remote に投入する。

```sh
pnpm wrangler d1 execute icho26 --remote --file=db/seed/checkpoint-codes-prod.sql
```

(本番ファイルはコミットしない、または明確に分けて取り扱う)

## 9. テスト構成

- **unit**: `tests/lib/**/*.test.ts`(normalize / transitions / password 等)
- **integration**: 必要に応じて Vitest + Miniflare で loader / action を直接呼ぶ(未実装、`docs/openissues.md` 参照)
- **e2e**: 自動化しない。`pnpm dev` 手動確認 + Workers Builds の PR preview deploy で確認

CI で実行するのは lint / format / typecheck / unit + integration test。

## 10. 受け入れチェック(手動、リリース前)

- [ ] `/start/:groupId` で開始 → `/q1` 到達
- [ ] Q1 サブ問題ランダム順序が固定される(再開で再抽選されない)
- [ ] 全問正解で `/release` → `/complete` → `/complete/epilogue` まで到達
- [ ] `/operator/login` でログイン成功 → ダッシュボード表示
- [ ] 新規 ID 発行 → コピーした URL でセッション開始
- [ ] グループ詳細でステータス補正 + 報告済み付与が反映される
- [ ] モバイル実機(縦持ち)で主要画面が崩れない

## 11. 監視 / ロギング

- 詳細な監視基盤は構築しない
- 障害発生時は Cloudflare dashboard の Workers Logs を直接確認
- 必要に応じて `console.error` で request id とコンテキストを出力
