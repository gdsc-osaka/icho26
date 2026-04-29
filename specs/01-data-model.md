# 01 データモデル

依存: `00-architecture.md`

このドキュメントは D1 のテーブル設計と Drizzle 実装方針を定義する。

## 1. 方針

- **D1 が唯一の正データ**。更新はトランザクションで実行する
- **過度な最適化は避ける**: idempotency key、`state_version` 楽観ロック、KV キャッシュは導入しない。本イベントの規模(同時接続 数十)では追加コストに見合わない
- スキーマは `db/schema/<table>.ts` に分割し、`db/schema/index.ts` で集約 export する
- マイグレーションは `pnpm db:generate`(Drizzle Kit)で生成する。手書きしない

## 2. enum 値

実装内の TypeScript const として固定する。DB 側は `text` で保持する。

```typescript
export const STAGES = ['START', 'Q1', 'Q2', 'Q3_KEYWORD', 'Q3_CODE', 'Q4', 'FAKE_END', 'COMPLETE'] as const;
export const Q1_ORDERS = ['Q1_1_FIRST', 'Q1_2_FIRST'] as const;
export const SUB_QUESTIONS = ['Q1_1', 'Q1_2'] as const;
export const ANSWER_STAGES = ['Q1_1', 'Q1_2', 'Q2', 'Q3_KEYWORD', 'Q3_CODE', 'Q4'] as const;
```

## 3. テーブル

### 3.1 `users`(参加者グループ)

| カラム | 型 | 説明 |
|---|---|---|
| `group_id` | text PK | `g_` + UUIDv4(小文字、ハイフン区切り) |
| `current_stage` | text NOT NULL | `STAGES` のいずれか。初期値 `START` |
| `group_name` | text NULL | 運営ダッシュボードの ID 発行時に入力する代表者の本名 or ニックネーム。社員証印刷および AI チャットボットでの呼び掛けに使う。参加者の `/start/:groupId` 経由で作成された行は NULL |
| `group_size` | integer NULL | 同上の人数。1 以上の整数。NULL は未登録 |
| `q1_order` | text NULL | `Q1_ORDERS` のいずれか。Q1 開始時に決定し以降不変 |
| `q1_1_cleared` | integer NOT NULL DEFAULT 0 | 0/1 |
| `q1_2_cleared` | integer NOT NULL DEFAULT 0 | 0/1 |
| `q2_cleared` | integer NOT NULL DEFAULT 0 | 0/1(checkpoint まで完了で 1) |
| `started_at` | text NULL | ISO 8601 |
| `completed_at` | text NULL | `COMPLETE` 到達時刻 |
| `reported_at` | text NULL | 運営の報告フラグ付与時刻 |
| `epilogue_viewed_at` | text NULL | |
| `created_at` | text NOT NULL | |
| `updated_at` | text NOT NULL | |

Index: `idx_users_updated_at`(ダッシュボードの新着順表示で利用)

### 3.2 `attempt_logs`(回答試行)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | text PK | UUIDv4 |
| `group_id` | text NOT NULL | FK 相当 |
| `stage` | text NOT NULL | `ANSWER_STAGES` のいずれか |
| `raw_input` | text NOT NULL | ユーザー入力そのまま |
| `normalized_input` | text NOT NULL | 正規化後の値 |
| `correct` | integer NOT NULL | 0/1 |
| `created_at` | text NOT NULL | |

Index: `idx_attempt_logs_group_stage`(`group_id`, `stage`) — 試行回数集計に使用

### 3.3 `progress_logs`(進行イベント)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | text PK | UUIDv4 |
| `group_id` | text NOT NULL | |
| `event_type` | text NOT NULL | `STAGE_TRANSITION` / `CHECKPOINT_COMPLETED` / `EPILOGUE_VIEWED` / `Q1_ORDER_ASSIGNED` |
| `from_stage` | text NULL | |
| `to_stage` | text NULL | |
| `detail` | text NULL | JSON 文字列の補足 |
| `created_at` | text NOT NULL | |

Index: `idx_progress_logs_group`(`group_id`)

### 3.4 `checkpoint_codes`(会場 QR/NFC 用コード)

| カラム | 型 | 説明 |
|---|---|---|
| `code` | text PK | 会場 QR に埋め込む固定文字列 |
| `stage` | text NOT NULL | `Q1_1` / `Q1_2` / `Q2` |
| `label` | text NULL | 設置場所メモ(運用用) |
| `active` | integer NOT NULL DEFAULT 1 | 0/1 |
| `created_at` | text NOT NULL | |

### 3.5 `operator_credentials`

単一運営アカウント。常に 1 行。

| カラム | 型 | 説明 |
|---|---|---|
| `operator_id` | text PK | 常に `"operator"` |
| `password_hash_b64` | text NOT NULL | PBKDF2-SHA256 ハッシュの Base64 |
| `password_salt_b64` | text NOT NULL | salt(16 byte 以上)の Base64 |
| `password_iterations` | integer NOT NULL | 100000(Cloudflare Workers PBKDF2 の上限) |
| `created_at` | text NOT NULL | |
| `updated_at` | text NOT NULL | |

### 3.6 `operator_sessions`

| カラム | 型 | 説明 |
|---|---|---|
| `session_id` | text PK | 署名付きランダム文字列 |
| `operator_id` | text NOT NULL | 常に `"operator"` |
| `expires_at` | text NOT NULL | ISO 8601、ログインから 12 時間 |
| `revoked_at` | text NULL | ログアウト時に書く |
| `created_at` | text NOT NULL | |

Index: `idx_operator_sessions_expires`(期限切れセッション一括削除用)

### 3.7 `operator_actions`(運営の介入監査ログ)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | text PK | UUIDv4 |
| `operator_id` | text NOT NULL | 常に `"operator"` |
| `group_id` | text NOT NULL | |
| `action_type` | text NOT NULL | `STATUS_CORRECTION` / `MARK_REPORTED` |
| `from_stage` | text NULL | |
| `to_stage` | text NULL | |
| `reason_code` | text NOT NULL | |
| `note` | text NULL | |
| `created_at` | text NOT NULL | |

## 4. ファイル分割

```
db/
├── schema/
│   ├── users.ts
│   ├── attempt-logs.ts
│   ├── progress-logs.ts
│   ├── checkpoint-codes.ts
│   ├── operator-credentials.ts
│   ├── operator-sessions.ts
│   ├── operator-actions.ts
│   └── index.ts        # 全テーブル + enum 値の集約 export
└── migrations/
    └── 0001_initial.sql
```

## 5. マイグレーション運用

- 初期: `0001_initial.sql` を `pnpm db:generate` で生成
- 追加変更: 連番で追加。既存ファイルは編集しない
- ローカル適用: `wrangler d1 execute --local <database-name> --file db/migrations/0001_initial.sql`
- 本番適用: 06(CI / デプロイ)で定義する手順に従う

## 6. seed

初期投入(本番デプロイ時に手動実行):

- `operator_credentials` に運営パスワードのハッシュを 1 行投入
- `checkpoint_codes` に各 stage(`Q1_1` / `Q1_2` / `Q2`)用のコードを投入

ローカル開発用の seed スクリプト位置: `db/seed/local.ts`(必要になった時点で追加)

## 7. データ保持

- 本イベント運用想定。30 日リテンション + 日次クリーンアップ等の自動化は行わない
- イベント後、不要になった行は手動削除する
