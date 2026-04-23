# 05 D1データモデルとDrizzle実装詳細

このドキュメントは、`tech-specs.md` のDDLを実装用に具体化する。

依存: `04-application-skeleton-and-dependency-injection.md`

## 1. 方針

- D1が正データ
- すべての更新系APIはD1トランザクションで処理
- `users.state_version` を楽観ロックとして使用
- `idempotency_keys` を30日保持

## 2. Drizzle schema ファイル分割

```text
db/schema/
  users.ts
  logs.ts
  operator-auth.ts
  idempotency.ts
  checkpoint.ts
  index.ts
```

## 3. 型定義（重要カラム）

### users

- `groupId: text primary key`
- 形式: `g_` + `UUIDv4`（小文字ハイフン区切り）
- `currentStage: text`（enum相当）
- `stateVersion: integer not null default 0`
- `q1Order: text nullable`
- `currentUnlockedSubquestion: text nullable`
- 各フラグ: integer(0/1)
- `startedAt`, `completedAt`, `reportedAt`, `epilogueViewedAt`
- `createdAt`, `updatedAt`

### idempotencyKeys

- PK: `(groupId, apiName, idempotencyKey)`
- `responseJson`（初回レスポンスを保存）
- `statusCode`
- `expiresAt`

### operatorSessions

- `sessionId: text pk`
- `operatorId: text`
- `expiresAt: text`
- `revokedAt: text nullable`
- `createdAt: text`
- 単一運営アカウント制約として `operatorId = operator` を常に維持

### operatorCredentials

- `operatorId: text primary key`（常に `"operator"`）
- `passwordHashB64: text not null`（PBKDF2-SHA256 ハッシュの Base64）
- `passwordSaltB64: text not null`（16byte 以上の salt の Base64）
- `passwordIterations: integer not null`（初期 210000）
- `createdAt: text not null`
- `updatedAt: text not null`

### userProgressLogs

- `id: text primary key`（UUIDv4）
- `groupId: text not null`（FK: users.groupId）
- `eventType: text not null`（`STAGE_TRANSITION`, `CHECKPOINT_COMPLETED`, `EPILOGUE_VIEWED` 等）
- `fromStage: text nullable`
- `toStage: text nullable`
- `detail: text nullable`（JSON 形式の補足情報）
- `createdAt: text not null`

### attemptLogs

- `id: text primary key`（UUIDv4）
- `groupId: text not null`（FK: users.groupId）
- `stage: text not null`（`Q1_1`, `Q1_2`, `Q2`, `Q3_KEYWORD`, `Q3_CODE`, `Q4`）
- `rawInput: text not null`（ユーザー入力そのまま）
- `normalizedInput: text not null`（正規化後）
- `correct: integer not null`（0/1）
- `createdAt: text not null`

### hintLogs

- `id: text primary key`（UUIDv4）
- `groupId: text not null`（FK: users.groupId）
- `stage: text not null`
- `userMessage: text not null`（ユーザー入力全文）
- `assistantMessage: text not null`（AI 応答全文）
- `hintLevel: integer not null`（1/2/3）
- `createdAt: text not null`

### operatorActions

- `id: text primary key`（UUIDv4）
- `operatorId: text not null`（常に `"operator"`）
- `groupId: text not null`（FK: users.groupId）
- `actionType: text not null`（`STATUS_CORRECTION`, `MARK_REPORTED`）
- `fromStage: text nullable`
- `toStage: text nullable`
- `reasonCode: text not null`
- `note: text nullable`
- `createdAt: text not null`

### operatorSessionEvents

- `id: text primary key`（UUIDv4）
- `operatorId: text not null`（常に `"operator"`）
- `sessionId: text not null`（FK: operatorSessions.sessionId）
- `eventType: text not null`（`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `CACHE_MISS`）
- `ipAddress: text nullable`
- `createdAt: text not null`

### checkpointCodes

- `code: text primary key`（チェックポイント認証コード）
- `stage: text not null`（`Q1_1`, `Q1_2`, `Q2`）
- `label: text nullable`（運用メモ: 設置場所名など）
- `active: integer not null default 1`（0/1、無効化可能）
- `createdAt: text not null`

## 3.1 チェックポイントコード運用

チェックポイントコードは会場 QR に埋め込む固定文字列。`checkpointCodes` テーブルで管理する。

検証フロー:
1. クライアントが `/q1/:sub/checkpoint?code=XXXX` でアクセス
2. `action` で `checkpointCodes` テーブルを参照
3. `code` が存在し、`active = 1` かつ `stage` が現在のステージに一致すれば有効
4. 無効なコードは `BAD_REQUEST` を返す

seed データ（初期投入）:
- `Q1_1` 用: `"CP-Q1-1-ALPHA"`（仮値、会場 QR 印刷前に本番値へ差し替え）
- `Q1_2` 用: `"CP-Q1-2-BRAVO"`（仮値）
- `Q2` 用: `"CP-Q2-CHARLIE"`（仮値）

Drizzle schema 配置: `db/schema/checkpoint.ts`

## 4. enum値固定

実装内の定数として固定する。

- `CurrentStage`
  - `START`, `Q1`, `Q2`, `Q3_KEYWORD`, `Q3_CODE`, `Q4`, `FAKE_END`, `COMPLETE`
- `Q1Order`
  - `Q1_1_FIRST`, `Q1_2_FIRST`
- `SubQuestion`
  - `Q1_1`, `Q1_2`

## 5. Repository実装要件

`app/modules/*/infrastructure/` に以下を作成（責務ごとに配置）。

- `app/modules/progress/infrastructure/progress-repository.d1.server.ts`
- `app/modules/progress/infrastructure/idempotency-repository.d1.server.ts`
- `app/modules/operator-session/infrastructure/operator-session-repository.d1.server.ts`
- `app/modules/operator-session/infrastructure/operator-credential-repository.d1.server.ts`
- `app/modules/progress/infrastructure/progress-transaction.d1.server.ts`

## 6. トランザクションの実装規約

更新系UseCaseで共通処理を使う。

1. `idempotency_keys` 参照（同一キーがあれば即返却）
2. `users` を取得
3. Domainで遷移検証
4. `WHERE state_version = :current` で更新
5. 成功時にログテーブルと `idempotency_keys` へINSERT
6. commit後にKV世代インクリメント

## 7. SQLインデックス方針

`tech-specs.md` で定義済みのindexをそのまま適用し、省略しない。

特に重要:

- `idx_users_updated_at`
- `idx_operator_sessions_expires`
- `idx_idempotency_expires`

ログ系テーブル（日次クリーンアップ用）:

- `idx_user_progress_logs_created_at` on `userProgressLogs(createdAt)`
- `idx_attempt_logs_created_at` on `attemptLogs(createdAt)`
- `idx_hint_logs_created_at` on `hintLogs(createdAt)`
- `idx_operator_actions_created_at` on `operatorActions(createdAt)`
- `idx_operator_session_events_created_at` on `operatorSessionEvents(createdAt)`

参照クエリ用:

- `idx_attempt_logs_group_stage` on `attemptLogs(groupId, stage)`
- `idx_user_progress_logs_group` on `userProgressLogs(groupId)`

## 8. マイグレーション運用

- 初期migration: `0001_initial.sql`
- 追加変更: 連番で追加、既存ファイルを書き換えない
- schema変更時は必ず `drizzle-kit` で差分生成

## 9. seed方針

初期seed:

- `operator_credentials` に `operator` の1行を投入
- `checkpoint_codes` に各ステージのチェックポイントコードを投入（仮値: `CP-Q1-1-ALPHA`, `CP-Q1-2-BRAVO`, `CP-Q2-CHARLIE`）
- ローカル開発向けテスト `users` を任意投入

seed実行は自動化せず、`prod` で手動承認のうえ実行する。

運営認証のドメイン制約:

- `operator_sessions.operator_id` と `operator_session_events.operator_id` は常に `operator` を記録する
