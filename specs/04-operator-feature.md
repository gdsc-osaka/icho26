# 04 運営者 feature

依存: `01-data-model.md`, `02-ui-design-foundation.md`, `03-participant-feature.md`

このドキュメントは運営者向けの全機能(ログイン、ID 発行、進捗ダッシュボード、グループ詳細、補正・報告)を定義する。BE と UI を一括で扱う。

## 1. 全体像

- 運営アカウントは 1 つだけ(`operator_id = "operator"`)
- Cookie ベースのセッション認証
- ID 発行・QR 配布・進捗確認・救済操作を 1 画面群で完結させる
- 規模が小さいため KV キャッシュは使わず D1 直参照

## 2. ルート一覧

| パス | ファイル | 役割 |
|---|---|---|
| `/operator/login` | `routes/operator.login.tsx` | ログイン画面(認証不要) |
| `/operator` | `routes/operator.tsx` | レイアウト(認証ガード) |
| `/operator/dashboard` | `routes/operator.dashboard.tsx` | 進捗ダッシュボード(一覧 + 新規 ID 発行) |
| `/operator/group/:groupId` | `routes/operator.group.$groupId.tsx` | グループ詳細・補正操作 |

`routes.ts` への追加例:

```typescript
import { type RouteConfig, route, layout } from "@react-router/dev/routes";

// 03 の participant ルートに以下を追加
route("operator/login", "routes/operator.login.tsx"),
layout("routes/operator.tsx", [
  route("operator/dashboard", "routes/operator.dashboard.tsx"),
  route("operator/group/:groupId", "routes/operator.group.$groupId.tsx"),
]),
```

## 3. `app/lib/operator/` の構成

```
app/lib/operator/
├── password.ts       # PBKDF2 ハッシュ生成・検証
├── session.ts        # Cookie 操作 + セッション検証
├── auth.ts           # ログイン処理(資格検証 + セッション発行)
├── queries.ts        # ダッシュボード一覧 / グループ詳細
└── mutations.ts      # status-correction / mark-reported / 新規 ID 発行
```

## 4. パスワード(`password.ts`)

- アルゴリズム: `PBKDF2-SHA256`
- salt: 16 byte 以上(`crypto.getRandomValues`)
- iteration: 100000(Cloudflare Workers の WebCrypto PBKDF2 が 100,000 を超える値を `NotSupportedError` で拒否するため、これがプラットフォーム上限。`operator_credentials.password_iterations` で per-row 更新可)
- key length: 32 byte
- 比較は一定時間比較(`crypto.subtle.timingSafeEqual` 相当の自前実装、または `===` 比較前にバイト長を一致させる)

API:

```typescript
export async function hashPassword(plain: string, saltB64: string, iterations: number): Promise<string>;
export async function verifyPassword(plain: string, hashB64: string, saltB64: string, iterations: number): Promise<boolean>;
```

実装は `crypto.subtle.deriveBits`(Workers でも利用可)を使う。

## 5. セッション(`session.ts`)

- Cookie 名: `operator_session`
- 値: 署名なし `session_id`(D1 で照合するためそれ自体が認証材料。`crypto.getRandomValues` で 32 byte 生成し base64url エンコード)
- 属性: `HttpOnly` / `Secure` / `SameSite=Strict` / `Path=/` / 有効期限 12 時間

API:

```typescript
export function getSessionIdFromRequest(request: Request): string | null;
export function setSessionCookie(sessionId: string): string;
export function clearSessionCookie(): string;

export async function verifySession(db: DrizzleD1Database, sessionId: string): Promise<{ operatorId: string } | null>;
```

`verifySession` は D1 を引いて以下を確認:
- レコードが存在する
- `revoked_at` が NULL
- `expires_at` が現在時刻より後

満たさなければ `null` を返す。

## 6. 認証ガード

`/operator` レイアウトの `loader` で `verifySession` を呼び、未認証なら `/operator/login` へリダイレクトする。

```typescript
// routes/operator.tsx
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) throw redirect("/operator/login");

  const db = drizzle(env.DB);
  const session = await verifySession(db, sessionId);
  if (!session) throw redirect("/operator/login");

  return { operatorId: session.operatorId };
}

export default function OperatorLayout() {
  return <Outlet />;
}
```

## 7. ログイン(`/operator/login`)

### loader

既にログイン済みなら `/operator/dashboard` へリダイレクト。

### action

- フォーム入力: `password`
- `operator_credentials` の 1 行を取得
- `verifyPassword` で照合
- 成功時:
  1. `session_id` 生成
  2. `operator_sessions` に INSERT(`expires_at` = 現在 + 12 時間)
  3. `Set-Cookie` ヘッダ付きで `/operator/dashboard` へリダイレクト
- 失敗時: 同一画面にエラー表示「認証に失敗しました」

ログイン失敗イベントの詳細ログは記録しない(本イベント規模では不要)。

### UI

- 中央寄せのシンプルなフォーム(パスワード 1 つ + 送信ボタン)
- `02` で定義した `SystemPanel` + `TextInput` + `GlowButton` を利用
- 失敗時は `ErrorAlert` で表示

## 8. ログアウト

`/operator/logout` は専用ルートを作らず、`/operator/dashboard` 内のログアウトボタンの form action として `/operator/login?action=logout` 等で処理する。シンプルに POST 専用 action を `routes/operator.login.tsx` に同居させる。

処理:
1. `operator_sessions.revoked_at` を現在時刻で更新
2. Cookie を削除
3. `/operator/login` へリダイレクト

## 9. ダッシュボード(`/operator/dashboard`)

### loader

- 全 `users` を `updated_at` 降順で取得(D1 直参照、ページング不要 — 数十グループ想定)
- 各行に試行回数の合計を集計(`attempt_logs` を `group_id` で集計)

レスポンス例:

```typescript
type DashboardRow = {
  groupId: string;
  currentStage: Stage;
  attemptCountTotal: number;
  reportedAt: string | null;
  startedAt: string | null;
  updatedAt: string;
};
```

### action(新規 ID 発行)

- フォーム入力:
  - `group_name` (必須・空白除去後 1 文字以上): 代表者の本名 or ニックネーム。社員証印刷と AI チャットボットの呼び掛けに使う
  - `group_size` (必須・1 以上の整数)
- バリデーション失敗時は `{ ok: false, error }` を返す
- 新規 `groupId` (`g_` + UUIDv4)を生成
- `users` に INSERT(`current_stage = 'START'`, `group_name`, `group_size`)
- 成功時は `{ ok: true, issuedGroupId, groupName, groupSize }` を返し、
  クライアントは戻り値を検知して LX-D02 へ社員証を自動印刷する

### UI

- 一覧テーブル(`groupId` / グループ名 / 人数 / 現在ステージ / 試行回数 / 報告済 / 更新時刻)
- 各行に「詳細」リンク(`/operator/group/:groupId`)
- 上部に「新規 ID 発行」フォーム(グループ名 + 人数 + 発行ボタン)
- フォーム上部に `PrinterPanel`(LX-D02 接続状態 / 接続ボタン / フォントロード状況)
- 発行直後は ID と開始 URL(`https://<domain>/start/<groupId>`) + 印刷ステータスを表示

### 社員証印刷(LX-D02 サーマルプリンタ)

- Web Bluetooth API + `lx-printer` を使用しブラウザから直接印刷する
- ID 発行時に自動印刷、`/operator/group/:groupId` から再印刷も可能
- レイアウト(幅 384px・可変高):
  - 会社名 `ZEUS Inc.`(BDF 16x16 を 2 倍拡大)
  - グループ名(BDF 16x16)
  - 人数(BDF 16x16, `人数: N 名`)
  - QR コード(`https://<origin>/start/<groupId>`)
- フォントは `public/fonts/b16.bdf` を `bdfparser` で読み込み(ページマウント時に eager fetch + キャッシュ)
- Web Bluetooth はユーザージェスチャ必須のため、初回のみ「プリンタを接続」ボタンでペアリング。以降は接続を維持して自動印刷
- プリンタ未接続時は自動印刷をスキップし、詳細画面から再印刷できることを告知

## 10. グループ詳細(`/operator/group/:groupId`)

### loader

- 該当 `users` レコード
- 該当 `attempt_logs` 全件(時系列降順)
- 該当 `progress_logs` 全件
- 該当 `operator_actions` 全件

### action(複数機能を分岐)

`form` 内 `_action` フィールドで分岐:

- `_action=status-correction` — `from_stage` / `to_stage` / `reason_code` / `note` を受けて `users.current_stage` を更新、`operator_actions` に監査ログ記録
- `_action=mark-reported` — `users.reported_at` を現在時刻で更新、`operator_actions` に記録(`reason_code` / `note` も受ける)

両方とも `mutations.ts` でトランザクション処理する。

### UI

- ステータス補正フォーム(セレクトボックス + 理由コード + メモ)
- 報告済みフラグ付与ボタン(未付与時のみ表示、確認モーダル)
- 試行ログ・進行ログ・監査ログをそれぞれセクション分けして表示

ワイドレイアウトを利用する(`md` 以上で 2 カラム)。

## 11. クエリ・更新の詳細(`queries.ts` / `mutations.ts`)

### queries.ts

- `listUsers(db): Promise<DashboardRow[]>`
- `getUserDetail(db, groupId): Promise<{ user: UserRow; attempts: AttemptLog[]; progress: ProgressLog[]; actions: OperatorAction[] } | null>`

### mutations.ts

- `createUser(db, groupId, now, opts?)` — 新規 ID 発行(`opts.groupName`, `opts.groupSize` は運営ダッシュボード経由のみ指定。参加者の `/start/:groupId` フォールバック作成では省略)
- `correctStatus(db, params: { operatorId; groupId; fromStage; toStage; reasonCode; note; now })` — トランザクション内で `users` 更新 + `operator_actions` INSERT + `progress_logs` INSERT
- `markReported(db, params: { operatorId; groupId; reasonCode; note; now })` — 同上
- `revokeSession(db, sessionId, now)` — ログアウト
- `createSession(db, params: { sessionId; operatorId; expiresAt; createdAt })` — ログイン

すべてトランザクションで実行する。

## 12. enum 整合性

`current_stage` の補正対象は `STAGES` のいずれか。フロント側でセレクトボックスの選択肢を `STAGES` から生成する。

## 13. テスト観点

- `password.ts` の hash/verify が往復できる(unit)
- セッション有効期限切れで `verifySession` が `null` を返す(unit)
- 認証ガード loader が未認証時にリダイレクトする(integration)
- `correctStatus` 実行で `users` と `operator_actions` が両方更新される(integration、トランザクション一貫性)
- ログアウト後の再アクセスが `/operator/login` へリダイレクトする(integration)
