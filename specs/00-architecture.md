# 00 アーキテクチャ概要

このドキュメントは icho26 プロジェクトの全体方針を定義する。01 以降の各仕様はこのドキュメントに従う。

## 1. 設計原則

- **開発コスト最小化を最優先する**
- 過剰な抽象化を持ち込まない
  - domain layer / ports / composition root のような中間層は採用しない
  - 必要になってから切り出す
- backend / frontend を物理的に分離せず、React Router v7 の framework mode を活用する
- 再利用される純粋関数・DB クエリは feature 単位で `app/lib/` に切り出す
- **feature 単位で backend + UI を同時に実装する**(vertical slice)
  - レイヤ分割で別々に作ると BE と UI の整合が崩れるため、ひとつの feature を完結させる単位で進める
  - 仕様書も feature ごとに 1 本にまとめる(BE 仕様 / UI 仕様 を別ファイルにしない)

## 2. 想定規模

- 1 イベント運用向けの単一アプリ
- 同時接続: 数十 〜 数百
- 開発者: 少人数(2-3 名)、feature 単位で並行開発する想定

## 3. 技術スタック

| 層 | 採用技術 |
|----|---------|
| ランタイム | Cloudflare Workers |
| フレームワーク | React Router v7 (framework mode) |
| ビルド | Vite |
| DB | Cloudflare D1 + Drizzle ORM |
| キャッシュ / セッション補助 | Cloudflare KV |
| スタイリング | Tailwind CSS v4 |
| パッケージマネージャ | pnpm |
| ローカル開発 | Wrangler (`pnpm dev`) |
| テスト | Vitest |
| インフラ管理 | Terraform(Cloudflare D1 / KV のリソース宣言) |

## 4. アーキテクチャ方針

### 4.1 抽象ゼロ、loader/action 直書き

- ルートファイル(`app/routes/*.tsx`)が **UI + サーバ側ロジック(loader / action)** を兼ねる
- DB アクセスは loader / action 内から直接呼ぶ
- 独立した「API 層」を作らない。loader / action がそのまま HTTP 境界

### 4.2 feature 別の `app/lib/`

複数人開発時の衝突を減らすため、再利用ロジックは feature 単位で切る。

```
app/lib/
├── participant/   # 参加者機能(クエリ、純粋関数、型)
├── operator/      # 運営者機能
└── shared/        # feature 横断の純粋関数・ユーティリティ
```

`lib/<feature>/` の典型的な内訳(必要になった時点で追加。最初から全部作らない):

- `queries.ts` — Drizzle を使った read 系クエリ
- `mutations.ts` — write 系クエリ
- `transitions.ts` — 状態遷移などの純粋関数
- `types.ts` — feature 固有の型
- `validation.ts` — Zod スキーマ等

### 4.3 共通 UI

- `app/components/` に共通 atoms(Button, Panel, Input 等)を置く
- feature 固有 UI は最初ルートファイル内に直書き、再利用が出てきたら `app/lib/<feature>/components/` に切り出す

## 5. ディレクトリ構造

```
app/
├── app.css
├── root.tsx
├── routes.ts
├── routes/                # UI + loader/action
├── components/            # 共通 UI atoms
└── lib/
    ├── participant/
    ├── operator/
    └── shared/
db/
├── schema/                # Drizzle 定義(全テーブル集約)
└── migrations/
specs/                     # 仕様書
tests/                     # Vitest setup
public/                    # 静的ファイル
```

## 6. データ層

- D1 を Cloudflare Workers バインディング `DB` で利用
- スキーマは `db/schema/<table>.ts` に分割し、`db/schema/index.ts` で集約 export
- マイグレーションは `pnpm db:generate` で Drizzle Kit が生成
- ローカル適用は `wrangler d1 execute --local`
- KV(バインディング `CACHE`)は idempotency キー / セッション補助等で利用

### feature 横断リレーション

リレーションが feature をまたぐ場合(例: 参加者ログ → 運営介入レコード)もスキーマは `db/schema/` に集約する。`lib/participant/queries.ts` から `lib/operator/` のテーブルを参照することは許容する。過度な疎結合は本プロジェクトの目的に反する。

## 7. 認証

- **運営者**: Cookie ベースのセッション、署名キーは `.dev.vars` の `SESSION_SIGNING_KEY`
- **参加者**: 匿名識別(セッションキーで本人性を担保する程度)

詳細は運営者 feature の仕様で定義する。

## 8. UI / デザイン

- **Tailwind CSS v4 をスタイリングの主軸とする**
- デザイントークンは `app/app.css` の `@theme` ディレクティブで定義し、Tailwind ユーティリティとして利用する(`bg-panel`、`text-primary` のように)
- 複雑なアニメーション・グロー表現など Tailwind ユーティリティで書きにくいものは、`app/app.css` に `@layer components` で書くか、コンポーネント内の `<style>` に逃がす
- フォント: Space Grotesk(本文)+ JetBrains Mono(等幅)
- 視覚デザインは `design.md` を一次資料とする

## 9. テスト方針

- **純粋関数**: `lib/<feature>/*.ts` のうち状態遷移など重要なものは Vitest で unit テスト
- **loader / action**: 必要に応じて Miniflare ベースの統合テスト
- **E2E**: 自動 E2E は導入しない。ローカル `pnpm dev` での手動確認を基本とする
- テストは「コアロジックだけ守る」スタンス。網羅率は追わない

## 10. CI / デプロイ

- GitHub Actions で PR 毎に `pnpm build` + `pnpm test` を実行
- `main` へのマージで Cloudflare Workers にデプロイ
- 詳細は別 spec(後述の 06)で定義

## 11. ブランチ運用

- `main` を deployable に保つ
- 作業は必ず `feat/` / `fix/` / `chore/` プレフィックスのブランチで行い、PR 経由で squash merge
- 詳細は `CLAUDE.md` のブランチ戦略を参照

## 12. 仕様書の構成(予定)

01 以降は本ドキュメントの方針に沿って書き直す。書き直し過程で増減する可能性あり。

| # | タイトル | 概要 |
|---|---------|------|
| 00 | アーキテクチャ概要 | 本ドキュメント |
| 01 | データモデル | D1 スキーマ、Drizzle 定義、マイグレーション運用 |
| 02 | UI / デザイン基盤 | デザイントークン、共通 UI atoms、フォント |
| 03 | 参加者 feature | `lib/participant/` + 関連ルート + UI(BE と UI を同一仕様で扱う) |
| 04 | 運営者 feature | `lib/operator/` + 認証 + ダッシュボード(BE と UI を同一仕様で扱う) |
| 05 | インフラ・CI・デプロイ | Terraform(Cloudflare D1/KV)、GitHub Actions、Wrangler |
| 06 | 実装タスク一覧 | feature 単位の vertical slice を依存順に Step 化したロードマップ |

### 現状の実装状況(2026-04-29 時点)

`06: 実装タスク一覧` を書く際、以下は完了済みのため再記述しない。

- React Router v7 の framework mode セットアップ
- Cloudflare Workers アダプタ移行(`vite.config.ts` の `cloudflareDevProxy`、`wrangler.toml`、`.dev.vars`)
- TypeScript / Tailwind v4 / Drizzle Kit / Vitest の各設定ファイル

未着手:

- D1 / KV のリソース ID(`wrangler.toml` のプレースホルダのまま)
- `db/schema/`、`db/migrations/`(過去に存在したが wipe 済み)
- `app/lib/`、`app/components/`、`app/routes/` 配下の実装(`home.tsx` が hello world のみ)
