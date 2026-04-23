# 12 Cloudflare Workers アダプター移行と wrangler 設定

このドキュメントは、React Router v7 を Cloudflare Workers 上で稼働させるためのアダプター移行手順と wrangler.toml 設定を定義する。

依存: `01-repository-structure-and-implementation-guidelines.md`, `03-terraform-resource-definition-details.md`

## 1. 移行概要

現状は `@react-router/node` + `@react-router/serve`（Node.js ランタイム）で構成されている。
これを `@react-router/cloudflare` に置き換え、Cloudflare Workers 上で動作させる。

### 削除対象

- `@react-router/node`
- `@react-router/serve`
- `Dockerfile`（Workers デプロイに不要）

### 追加対象

- `@react-router/cloudflare`
- `wrangler`（dev / deploy CLI）
- `@cloudflare/workers-types`

## 2. パッケージ変更

```jsonc
// package.json（差分イメージ）
{
  "scripts": {
    "build": "react-router build",
    "dev": "react-router dev",
    "start": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "react-router typegen && tsc",
    "cf-typegen": "wrangler types"
  },
  "dependencies": {
    // 削除: "@react-router/node", "@react-router/serve"
    "@react-router/cloudflare": "7.14.0"
    // react, react-dom, react-router, isbot は維持
  },
  "devDependencies": {
    // 追加:
    "@cloudflare/workers-types": "^4.x",
    "wrangler": "^4.x"
  }
}
```

## 3. wrangler.toml

プロジェクトルートに配置する。

```toml
#:schema node_modules/wrangler/config-schema.json
name = "icho-game-prod-app"
main = "build/server/index.js"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "build/client"

[[d1_databases]]
binding = "DB"
database_name = "icho-game-prod-d1"
database_id = ""                        # Terraform output から取得

[[kv_namespaces]]
binding = "CACHE"
id = ""                                 # Terraform output から取得

[vars]
ENV = "prod"

# secrets は wrangler secret put で投入
# SESSION_SIGNING_KEY
# OPERATOR_PASSWORD_HASH_B64（初期シード時のみ）
# OPERATOR_PASSWORD_SALT_B64（初期シード時のみ）
# OPERATOR_PASSWORD_ITERATIONS（初期シード時のみ）
```

### ローカル開発用

`.dev.vars` をプロジェクトルートに作成し `.gitignore` に追加する。

```ini
SESSION_SIGNING_KEY=local-dev-signing-key
```

ローカル D1 は wrangler が自動で SQLite を使用する。

## 4. react-router.config.ts

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
} satisfies Config;
```

SSR は維持。Cloudflare アダプターは vite プラグイン経由で自動適用される。

## 5. vite.config.ts

```typescript
import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflareDevProxy(),
    tailwindcss(),
    reactRouter(),
  ],
});
```

- `cloudflareDevProxy()` は `reactRouter()` より前に配置する
- `resolve.tsconfigPaths` は削除し、tsconfig.json の `paths` を Vite が自動解決する

## 6. tsconfig 変更

```jsonc
{
  "compilerOptions": {
    // "types": ["node", "vite/client"] を以下に変更
    "types": ["@cloudflare/workers-types", "vite/client"]
  }
}
```

Node.js 型定義を Cloudflare Workers 型定義に置換する。

## 7. Env 型定義

`workers/bindings/env.ts` に Workers Binding の型を定義する。

```typescript
export interface AppEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  ENV: string;
  SESSION_SIGNING_KEY: string;
  OPERATOR_PASSWORD_HASH_B64?: string;
  OPERATOR_PASSWORD_SALT_B64?: string;
  OPERATOR_PASSWORD_ITERATIONS?: string;
}
```

この型は `wrangler types` で生成される `worker-configuration.d.ts` と整合させる。

## 8. loader / action での Binding アクセス

React Router v7 の Cloudflare アダプターでは `context.cloudflare.env` から Binding を取得する。

```typescript
// route の loader 例
export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as AppEnv;
  // env.DB, env.CACHE が利用可能
}
```

`app/composition.server.ts` の `getContainer(env)` へ渡す起点となる。

## 9. ローカル開発フロー

```bash
# 開発サーバー起動（Miniflare でローカル D1/KV をエミュレート）
pnpm dev

# D1 ローカルマイグレーション適用
wrangler d1 execute icho-game-prod-d1 --local --file=db/migrations/0001_initial.sql

# Binding 型生成
wrangler types
```

## 10. ビルドとデプロイ

```bash
# ビルド
pnpm build

# デプロイ（CI から実行、手動承認後）
wrangler deploy
```

ビルド成果物:
- `build/server/index.js` — Workers スクリプト
- `build/client/` — 静的アセット（Workers Assets で配信）

## 11. 削除対象ファイル

- `Dockerfile` — Workers デプロイでは不要
- Node.js 固有のサーバーエントリ（存在する場合）

## 12. Terraform との連携

- `wrangler.toml` の `database_id` と KV `id` は `terraform output` から取得する
- CI では Terraform apply 後に output 値を wrangler.toml へ注入するステップを設ける
- secrets は `wrangler secret put` で投入し、Terraform State に平文保存しない

## 13. 移行チェックリスト

- [ ] `@react-router/node`, `@react-router/serve` を削除
- [ ] `@react-router/cloudflare`, `wrangler`, `@cloudflare/workers-types` を追加
- [ ] `wrangler.toml` を作成
- [ ] `.dev.vars` を作成し `.gitignore` に追加
- [ ] `vite.config.ts` に `cloudflareDevProxy()` を追加
- [ ] `tsconfig.json` の types を変更
- [ ] `workers/bindings/env.ts` に型を定義
- [ ] `pnpm dev` でローカル起動を確認
- [ ] `pnpm build` でビルド成功を確認
- [ ] `Dockerfile` を削除
