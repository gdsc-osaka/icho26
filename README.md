# icho26

GDGoC Osaka いちょう祭 ストーリー進行型謎解きゲーム。

**スタック**: React Router v7(framework mode) + Cloudflare Workers + D1 + Drizzle + Tailwind CSS v4

- 詳細仕様: [`specs/`](./specs/)(00-アーキ概要 〜 06-実装タスク一覧)
- ストーリー: [`docs/story.md`](./docs/story.md)
- PRD: [`docs/specs.md`](./docs/specs.md)
- 既知の未実装事項: [`docs/openissues.md`](./docs/openissues.md)

## 前提ツール

| ツール | バージョン | 用途 |
|---|---|---|
| Node.js | 22+ | ランタイム |
| pnpm | 10+ | パッケージマネージャ |
| Git | 任意 | バージョン管理 |

`pnpm` が未導入なら `corepack enable && corepack prepare pnpm@latest --activate` でセットアップ。

## 初回セットアップ

```sh
git clone https://github.com/gdsc-osaka/icho26.git
cd icho26

# 依存インストール(postinstall で wrangler types が自動実行される)
pnpm install

# ローカル D1 にスキーマ + 開発用 seed を投入
pnpm wrangler d1 migrations apply icho26 --local
pnpm wrangler d1 execute icho26 --local --file=db/seed/checkpoint-codes.sql
pnpm wrangler d1 execute icho26 --local --file=db/seed/operator.sql

# 開発サーバ起動
pnpm dev
```

開発サーバが `http://localhost:5173` で起動する(他のプロセスがポートを使っている場合は別ポート)。

### 動作確認の最小フロー

1. 運営でログイン: `http://localhost:5173/operator/login` パスワード `operator-dev-only`
2. 「新規 ID 発行」で groupId を取得
3. 別タブ or 別ブラウザで `http://localhost:5173/start/<発行された groupId>` を開く
4. Q1 〜 Q4 を解いて(下記の "正解値" 参照)`/release` → `/complete/epilogue` まで到達

#### ローカル開発用の正解値

| 設問 | 正解 |
|---|---|
| Q1-1 | `42` |
| Q1-2 | `7` |
| Q2 | `coffeecup` |
| Q3 keyword | `hakidamenitsuru` |
| Q3 code | `2.24` |
| Q4 | `29` |

#### Q1 / Q2 の checkpoint コード(`db/seed/checkpoint-codes.sql` で投入)

| Stage | コード(URL に `?code=` 形式で渡す) |
|---|---|
| Q1_1 | `cp_q1_1_dev` |
| Q1_2 | `cp_q1_2_dev` |
| Q2 | `cp_q2_dev` |

例: 回答正解後、`http://localhost:5173/q1/1/checkpoint?code=cp_q1_1_dev` を直接開いて `VERIFY CHECKPOINT` ボタンで完了。本番では会場の物理 QR がこの URL を保持する想定。

## 主要コマンド一覧

| コマンド | 用途 |
|---|---|
| `pnpm dev` | 開発サーバ(HMR、SSR、Cloudflare DevProxy) |
| `pnpm typecheck` | 型チェック(`react-router typegen` + `tsc`) |
| `pnpm test` | Vitest 実行(CI 同等) |
| `pnpm test:watch` | Vitest watch モード |
| `pnpm lint` | ESLint 静的解析 |
| `pnpm lint:fix` | ESLint 自動修正 |
| `pnpm format` | Prettier で整形 |
| `pnpm format:check` | 整形チェック(CI 用) |
| `pnpm build` | 本番ビルド |
| `pnpm cf-typegen` | `worker-configuration.d.ts` 再生成(`wrangler.toml` 変更時) |
| `pnpm db:generate` | スキーマ変更から新規 migration 生成 |

## ディレクトリ構造

```
app/
├── components/        # 共通 UI atoms(SystemPanel, GlowButton, ...)
├── lib/
│   ├── participant/   # 参加者 feature(開始 + Q1-Q4 + エピローグ)
│   ├── operator/      # 運営者 feature(認証 + ダッシュボード + 介入)
│   └── shared/        # feature 横断(env, users)
├── routes/            # ルート(loader/action 直書き)
├── routes.ts          # ルート登録
└── root.tsx           # ルートコンポーネント

db/
├── schema/            # Drizzle テーブル定義
├── migrations/        # drizzle-kit 自動生成 SQL
└── seed/              # ローカル開発用 seed

specs/                 # 機能仕様(00-06)
tests/                 # Vitest unit テスト
workers/               # Cloudflare Workers 関連設定(load-context 拡張)
```

設計原則: feature 単位の vertical slice、抽象ゼロ(domain/ports/DI なし)、loader/action から直接 Drizzle を呼ぶ。詳細は [`specs/00-architecture.md`](./specs/00-architecture.md) を参照。

## データベース操作(ローカル D1)

ローカル D1 は `.wrangler/state/v3/d1/` 配下に SQLite ファイルとして保存される(gitignore 対象)。

### スキーマ変更 → 新規 migration

```sh
# 1. db/schema/*.ts を編集
# 2. migration を生成
pnpm db:generate
# → db/migrations/NNNN_<random>.sql が新規作成される

# 3. ローカル D1 に適用
pnpm wrangler d1 migrations apply icho26 --local
```

### Seed 再投入

```sh
pnpm wrangler d1 execute icho26 --local --file=db/seed/checkpoint-codes.sql
pnpm wrangler d1 execute icho26 --local --file=db/seed/operator.sql
```

両 seed とも `INSERT OR REPLACE` / `INSERT OR IGNORE` で書かれているので冪等。

### アドホックなクエリ実行

```sh
pnpm wrangler d1 execute icho26 --local --command="SELECT group_id, current_stage FROM users ORDER BY updated_at DESC LIMIT 10;"
```

### ローカル D1 をクリーンスタートしたい場合

```sh
rm -rf .wrangler/state/v3/d1
pnpm wrangler d1 migrations apply icho26 --local
pnpm wrangler d1 execute icho26 --local --file=db/seed/checkpoint-codes.sql
pnpm wrangler d1 execute icho26 --local --file=db/seed/operator.sql
```

## テスト

```sh
pnpm test         # 単発実行(CI 同等)
pnpm test:watch   # 変更検知で再実行
```

unit テストの対象は `lib/<feature>/` 配下の純粋関数(normalize / judge / transitions / password / session 等)。loader/action の integration テストは未実装。詳細は [`docs/openissues.md`](./docs/openissues.md)。

## Lint / Format

ESLint v9 flat config(`eslint.config.js`) + Prettier 3(`.prettierrc`)。

```sh
pnpm lint           # 検査
pnpm lint:fix       # 自動修正
pnpm format         # Prettier 整形
pnpm format:check   # CI 用検査
```

VS Code 等のエディタは ESLint / Prettier 拡張機能を有効にし、`editor.formatOnSave` を on にすると保存時に自動整形される。

## ブランチ運用

- `main` を deployable に保つ
- 作業ブランチは `feat/` / `fix/` / `chore/` プレフィックスで切る
- 必ず PR 経由で squash merge

詳細は [`CLAUDE.md`](./CLAUDE.md) のブランチ戦略を参照。

## 運営アカウントログイン(ローカル開発)

`db/seed/operator.sql` で投入される **ローカル開発用パスワード**:

```
operator-dev-only
```

`/operator/login` にこのパスワードでログインできる。**本番デプロイには絶対にこの seed を流さない** こと(`db/seed/operator.sql` 冒頭の警告参照)。

### 本番運営パスワード生成・投入

```sh
# 1. 強いパスワードを決める(コミットしない)
# 2. ハッシュを生成して remote D1 に直接投入
node db/seed/generate-operator-credentials.mjs '<chosen-password>' \
  | pnpm wrangler d1 execute icho26 --remote --command -

# 3. パスワード本体を out-of-band で運営メンバーに共有
```

## デプロイ

`main` への push を起点に Cloudflare Workers Builds が自動デプロイ。PR ごとに preview deploy も生成される。

CI(GitHub Actions)は PR 起動で `lint` / `format:check` / `typecheck` / `test` を実行。

詳細セットアップは [`specs/05-ci-deploy.md`](./specs/05-ci-deploy.md)、実装タスクは [`specs/06-implementation-tasks.md`](./specs/06-implementation-tasks.md) Step 7 を参照。

## トラブルシュート

### `Cannot find name 'Env'` / `Cannot find name 'D1Database'`

`worker-configuration.d.ts` が無いか古い。再生成:

```sh
pnpm cf-typegen
```

`pnpm install` の postinstall でも自動生成されるので、`pnpm install` をやり直すのも手。

### `Cannot find module '~/components'`(SSR エラー)

Vite の alias 解決失敗。`pnpm install` をやり直す。それでも解消しなければ `node_modules` を削除して再インストール:

```sh
rm -rf node_modules .react-router
pnpm install
```

### `wrangler d1 migrations apply` で `No migrations folder found`

`wrangler.toml` の `migrations_dir = "db/migrations"` 行があるか確認。

### `EBUSY: resource busy or locked, rmdir 'build/client'`(Windows)

`pnpm dev` 等が裏で動いていてファイルをロックしている。`pnpm dev` のターミナルを止めてから再実行。

### ESLint / Prettier が大量にエラー

```sh
pnpm format       # まず Prettier で全体整形
pnpm lint:fix     # ESLint 自動修正
pnpm lint         # 残ったエラーを個別対応
```

### ローカル D1 が壊れた / 不整合

```sh
rm -rf .wrangler/state/v3/d1
# 上記の "ローカル D1 をクリーンスタート" 手順で再構築
```

## 参考リンク

- React Router v7: https://reactrouter.com
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Drizzle ORM: https://orm.drizzle.team
- Tailwind CSS v4: https://tailwindcss.com/docs
- Vitest: https://vitest.dev
