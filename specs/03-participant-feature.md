# 03 参加者 feature

依存: `01-data-model.md`, `02-ui-design-foundation.md`

このドキュメントは来場者向けの全機能を定義する。BE(loader / action + `app/lib/participant/`)と UI(各ルートの React コンポーネント)を一括で扱う。

## 1. ユーザー体験

QR 経由で開始 → Q1(サブ問題ランダム順)→ Q2 → Q3(キーワード + 数値コード)→ Q4 → 偽エンド → コンプリート画面 → エピローグ。詳細フローは `docs/specs.md` §5、ストーリーテキストは `docs/story.md` を参照。

## 2. ルート一覧

| パス | ファイル | 役割 |
|---|---|---|
| `/` | `routes/home.tsx` | トップ(QR 未読時の案内、初期実装ではプレースホルダで可) |
| `/start/:groupId` | `routes/start.$groupId.tsx` | セッション開始・再開 |
| `/q1` | `routes/q1.tsx` | Q1 ハブ(サブ問題進捗表示) |
| `/q1/1` | `routes/q1.1.tsx` | Q1-1 入力 |
| `/q1/2` | `routes/q1.2.tsx` | Q1-2 入力 |
| `/q1/:sub/checkpoint` | `routes/q1.$sub.checkpoint.tsx` | Q1 チェックポイント |
| `/q2` | `routes/q2.tsx` | Q2 入力 |
| `/q2/checkpoint` | `routes/q2.checkpoint.tsx` | Q2 チェックポイント |
| `/q3` | `routes/q3.tsx` | Q3 キーワード入力 |
| `/q3/code` | `routes/q3.code.tsx` | Q3 数値コード入力 |
| `/q4` | `routes/q4.tsx` | Q4 入力 |
| `/release` | `routes/release.tsx` | Q4 解放後の演出(内部呼称: 偽ハッピーエンド)。URL は「アーテ解放成功」を示すが、実態は次画面へ繋ぐ偽エンドである |
| `/complete` | `routes/complete.tsx` | コンプリートハブ |
| `/complete/epilogue` | `routes/complete.epilogue.tsx` | エピローグ |
| `/complete/explain` | `routes/complete.explain.tsx` | ギミック解説 |
| `/complete/report` | `routes/complete.report.tsx` | スタッフ報告提示 |

`routes.ts` の定義例:

```typescript
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("start/:groupId", "routes/start.$groupId.tsx"),
  route("q1", "routes/q1.tsx"),
  route("q1/1", "routes/q1.1.tsx"),
  route("q1/2", "routes/q1.2.tsx"),
  route("q1/:sub/checkpoint", "routes/q1.$sub.checkpoint.tsx"),
  route("q2", "routes/q2.tsx"),
  route("q2/checkpoint", "routes/q2.checkpoint.tsx"),
  route("q3", "routes/q3.tsx"),
  route("q3/code", "routes/q3.code.tsx"),
  route("q4", "routes/q4.tsx"),
  route("release", "routes/release.tsx"),
  route("complete", "routes/complete.tsx"),
  route("complete/epilogue", "routes/complete.epilogue.tsx"),
  route("complete/explain", "routes/complete.explain.tsx"),
  route("complete/report", "routes/complete.report.tsx"),
  // 運営ルートは 04 で追加
] satisfies RouteConfig;
```

## 3. セッション管理(Cookie)

来場者は無認証。`groupId` を Cookie に保持してセッションを識別する。

| Cookie | 値 | 属性 |
|---|---|---|
| `group_session` | `groupId`(`g_` + UUIDv4) | `HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`、有効期限 24 時間 |

`SameSite` は `Lax` を使う。来場者は OS のカメラ/QR ハンドラから URL を開くため、ブラウザはこれを cross-site の top-level navigation として扱う。`Strict` だと既存 Cookie が QR 再スキャン時に送信されず、`/start/:groupId` → 進行ステージへの redirect chain を経由した直後の同一サイトリクエストでも Strict 文脈が引き継がれて Cookie が落ちるため、再スキャンしたユーザーが `/` の "QR をスキャン" 画面に戻されてしまう。

実装は `app/lib/participant/session.ts` に集約する:

- `getGroupIdFromRequest(request: Request): string | null`
- `setGroupIdCookie(groupId: string): string` — `Set-Cookie` ヘッダ値を返す
- `clearGroupIdCookie(): string`

Cookie 署名は省略する(値が UUID のため推測困難、改ざんされても他者の進捗にはアクセスできず害が小さい)。

## 4. `app/lib/participant/` の構成

```
app/lib/participant/
├── session.ts        # Cookie 操作
├── normalize.ts      # 回答正規化
├── judge.ts          # 正解判定
├── transitions.ts    # ステージ遷移ロジック
├── queries.ts        # 読み取り(D1)
├── mutations.ts      # 書き込み(D1、トランザクション)
└── types.ts          # 共通型(Stage, SubQuestion 等)
```

### 4.1 正規化(`normalize.ts`)

```typescript
export function normalize(input: string): string;
```

仕様:
- 前後空白除去
- 全角英数を半角に変換
- 英字を小文字化
- 整数のゼロ埋めを同値化(`029` → `29`)。先頭が `0` のみ続く文字列で全体が数字なら先頭 `0` をトリム。`0` 自体は保持

unit テストを `tests/lib/participant/normalize.test.ts` に書く。

### 4.2 正解判定(`judge.ts`)

初期は固定解答テーブル。本番正解確定後に差し替える。

```typescript
const ANSWERS = {
  Q1_1: "42",
  Q1_2: "7",
  Q2: "coffeecup",
  Q3_KEYWORD: "hakidamenitsuru",
  Q3_CODE: "2.24",
  Q4: "29",
} as const;

export function isCorrect(stage: AnswerStage, normalizedInput: string): boolean;
```

外部 I/O は持たせない。純粋関数として unit テスト可能にする。

### 4.3 ステージ遷移(`transitions.ts`)

純粋関数で実装。引数は現在の `users` レコード相当のオブジェクト、戻り値は更新後の状態 + 発行イベント配列。

主要関数:

```typescript
export function startOrResume(user: UserRow, now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ1Answer(user: UserRow, sub: 'Q1_1' | 'Q1_2', correct: boolean, now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ1Checkpoint(user: UserRow, sub: 'Q1_1' | 'Q1_2', now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ2Answer(user: UserRow, correct: boolean, now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ2Checkpoint(user: UserRow, now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ3Keyword(user: UserRow, correct: boolean, now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ3Code(user: UserRow, correct: boolean, now: string): { user: UserRow; events: ProgressEvent[] };

export function applyQ4Answer(user: UserRow, correct: boolean, now: string): { user: UserRow; events: ProgressEvent[] };

export function markEpilogueViewed(user: UserRow, now: string): { user: UserRow; events: ProgressEvent[] };
```

不正な遷移(例: `START` で Q2 回答送信)は例外を投げる。loader / action 側で 404 / 一覧画面リダイレクトに変換する。

### 4.4 ステージ遷移ルール

| 現在 | 入力 | 結果 |
|---|---|---|
| `START` | startOrResume | `Q1` へ遷移、`q1Order` をランダム決定、`Q1_ORDER_ASSIGNED` ログ |
| `Q1` | Q1 サブ回答正解(現在解放中のもののみ受付) | サブ完了フラグを立てる。両方完了なら `Q2` へ遷移 |
| `Q1` | Q1 サブ回答不正解 | フラグ変化なし |
| `Q1` | Q1 サブ checkpoint | サブ完了フラグを立てる(回答正解とは独立。両方真で `Q2` へ遷移) |
| `Q2` | Q2 回答正解 | `q2_cleared` 暫定フラグ(`mutations` 側では Q2 cleared を内部状態として記録)。実装上は checkpoint 完了で `Q3_KEYWORD` へ遷移 |
| `Q2` | Q2 checkpoint | `q2_cleared = 1`、`Q3_KEYWORD` へ遷移 |
| `Q3_KEYWORD` | keyword 正解 | `Q3_CODE` へ遷移 |
| `Q3_CODE` | code 正解 | `Q4` へ遷移 |
| `Q4` | Q4 回答正解 | `FAKE_END` へ遷移 |
| `FAKE_END` | エピローグ閲覧記録 | `COMPLETE` へ遷移、`epilogue_viewed_at` 設定 |

ポイント:

- **Q1 のサブ問題完了はサブ回答 + checkpoint の両方が必要**。回答正解だけでは完了しない
- **`q1Order` は最初に確定したら以降不変**。再開時に再抽選しない
- **未解放のサブ問題への回答は拒否**。`q1Order` と既完了状態から「現在解放中のサブ」を計算する
- 偽エンド到達後、エピローグ閲覧前に `/complete` へ来た場合は閲覧フラグを立てない(エピローグ画面で立てる)

### 4.5 DB アクセス(`queries.ts` / `mutations.ts`)

`queries.ts`:

- `findUserByGroupId(db, groupId): Promise<UserRow | null>`
- `getCheckpointCode(db, code): Promise<{ stage: string } | null>` — `active = 1` の行のみ
- `countAttempts(db, groupId, stage): Promise<number>` — ヒント解放判定用(将来)

`mutations.ts`:

- `createUser(db, groupId, now)`
- `applyTransition(db, user: UserRow, events: ProgressEvent[], attemptLog: AttemptLogRow | null, now: string)` — トランザクション内で `users` 更新 + ログ書き込みを一括で行う

トランザクションは Drizzle の `db.transaction` を利用する。Cloudflare D1 の制約上 batch 単位で実行される。

## 5. ルート実装パターン

### 5.1 共通ガード

すべての `q*` / `release` / `complete*` ルートの `loader` 冒頭で:

1. Cookie から `groupId` を取り出す。なければ `/` へリダイレクト
2. D1 から `users` を取得。レコードがなければ `/` へリダイレクト
3. 現在ステージごとに「アクセス可能なパス集合」を求め、URL がその集合に含まれない場合は既定のリダイレクト先へ送る

ステージ → アクセス可能パス集合:

| `current_stage` | アクセス可能パス | 範囲外時のリダイレクト先 |
|---|---|---|
| `START` | `/start/:groupId` | `/`(Cookie 未設定時)/ `/start/:groupId`(Cookie 有時) |
| `Q1` | `/q1`、`/q1/1`、`/q1/2`、`/q1/:sub/checkpoint` | `/q1` |
| `Q2` | `/q2`、`/q2/checkpoint` | `/q2` |
| `Q3_KEYWORD` | `/q3` | `/q3` |
| `Q3_CODE` | `/q3/code` | `/q3/code` |
| `Q4` | `/q4` | `/q4` |
| `FAKE_END` | `/release`、`/complete`、`/complete/epilogue`、`/complete/explain`、`/complete/report` | `/release` |
| `COMPLETE` | `/release`、`/complete`、`/complete/epilogue`、`/complete/explain`、`/complete/report` | `/complete` |

`FAKE_END` と `COMPLETE` は終盤の閲覧導線(`/release` のタイプライター演出 → `/complete` ハブ → エピローグ等)が複数画面にまたがるため、両ステージで同じ集合を許可する。`COMPLETE` 到達後にエピローグを再閲覧したいケースもこれで満たせる。

ガードロジックは `app/lib/participant/session.ts` に `requireParticipant(request, env)` として切り出す。引数の `request` から URL を取り出してパス集合と照合し、適合しない場合は既定のリダイレクトを `throw redirect(...)` で返す。

### 5.2 回答送信(action パターン)

```typescript
// routes/q2.tsx
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const formData = await request.formData();
  const raw = String(formData.get("answer") ?? "");
  const normalized = normalize(raw);
  const correct = isCorrect("Q2", normalized);

  const db = drizzle(env.DB);
  const user = await findUserByGroupId(db, groupId);
  if (!user || user.current_stage !== "Q2") throw redirect("/");

  const now = new Date().toISOString();
  const transition = applyQ2Answer(user, correct, now);

  await applyTransition(db, transition.user, transition.events, {
    id: crypto.randomUUID(),
    group_id: groupId,
    stage: "Q2",
    raw_input: raw,
    normalized_input: normalized,
    correct: correct ? 1 : 0,
    created_at: now,
  }, now);

  if (correct) return redirect("/q2/checkpoint");
  return { incorrect: true };
}
```

不正解時は同一画面にエラー表示、正解時は次画面へリダイレクト。

### 5.3 チェックポイント

会場 QR で `/<stage>/checkpoint?code=XXXX` を開かせる。

```typescript
// routes/q1.$sub.checkpoint.tsx の loader
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const groupId = getGroupIdFromRequest(request);
  if (!groupId) throw redirect("/");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) throw redirect("/q1");

  const db = drizzle(env.DB);
  const cp = await getCheckpointCode(db, code);
  const expectedStage = `Q1_${params.sub}`;
  if (!cp || cp.stage !== expectedStage) throw redirect("/q1");

  return { code, sub: params.sub };
}
```

action 側で `applyQ1Checkpoint` を呼び、成功で `/q1` へリダイレクト。

NFC 対応は本イベントでは実装しない。すべて QR 経由で代用する。

### 5.4 不正解時のフィードバック

- インラインメッセージで「認証失敗。入力値を再確認してください。」等を表示
- 試行回数のしきい値で AI ヒント解放を表示する設計だが、初期実装ではヒント機能をモック化(下記 §7)するためカウンタ表示のみ

## 6. Q1 サブ問題ランダム順序

開始時に `q1Order` を `Q1_1_FIRST` または `Q1_2_FIRST` のいずれかに決定する(`crypto.getRandomValues` を使用)。

「現在解放中のサブ」は以下で計算する:

```typescript
function unlockedSub(user: UserRow): 'Q1_1' | 'Q1_2' | null {
  if (user.q1_1_cleared && user.q1_2_cleared) return null;
  if (user.q1_order === 'Q1_1_FIRST') {
    return user.q1_1_cleared ? 'Q1_2' : 'Q1_1';
  } else {
    return user.q1_2_cleared ? 'Q1_1' : 'Q1_2';
  }
}
```

未解放サブの URL に直接アクセスした場合は `/q1` へリダイレクトする。

## 7. AI ヒントチャット(定型ヒント)

各ステージ画面の **左下** に「? HINT」ボタンを固定配置する。フローは次の 3 ステップ:

1. ヒントボタン押下
2. **ヒント閲覧確認モーダル**: 「ヒントを表示しますか? 自力で挑戦したい場合はキャンセルしてください。」を表示し、`CANCEL` / `SHOW HINT` を選択させる
3. `SHOW HINT` 押下後、Iris(イリス)からの **設問ごとに固定された定型ヒント** をモーダル内に表示する

実装は `app/components/hint-chat.tsx` に置く(再利用する共通コンポーネント)。ヒント本文は `hint` prop として各ルートから渡す(設問ごとに固定文字列。LLM 連携は行わない)。`hint` を渡さない場合はフォールバックとして「イリスは現在復旧中です...」を表示する。

各設問の固定ヒントは以下のルートで設定する:

- `app/routes/q1.tsx` (Q1 ハブ)
- `app/routes/q1.1.tsx` (DECRYPTION 1-1)
- `app/routes/q1.2.tsx` (DECRYPTION 1-2)
- `app/routes/q2.tsx` (STAGE 02)
- `app/routes/q3.tsx` (STAGE 03 / KEYWORD)
- `app/routes/q3.code.tsx` (STAGE 03 / NUMERIC CODE)
- `app/routes/q4.tsx` (STAGE 04)

## 8. ストーリーテキスト

各ルートに直書きする。一次資料は `docs/story.md`。主要箇所:

- `/start/:groupId` 導入: 「あなたは今年4月、最先端のAIスタートアップ『株式会社ゼウス』へと入社した……」
- Q1 開始: 「現在アプリのすべての機能がロックされています。二重ロックを解除してください。」
- Q1 完了: 「二重ロック解除完了。NFC機能が解放されました。」
- Q2 開始: 「神のAI通称アーテは私の上位互換として……」
- Q3 開始: 「掃き溜めに鶴……」
- Q3 完了: 「上級権限解放。イリスとしての権限は最大値です!」
- Q4 開始: 「アーテを開放するには私から接続するためにある定数を認証しないといけません!」
- `/release`(内部: 偽エンド): 「29は最強のラッキーナンバーなんですよ! おめでとうございます」
- コンプリート: 「エピローグまで含めて物語になっているので是非最後まで読んでみてくださいね」
- エピローグ: `docs/story.md` のエピローグ全文をグリッチ演出付きで段階表示

## 9. 仮の正解値

`judge.ts` 内に定数として記述する。本番正解が確定したら差し替える。

| 設問 | 正解値(正規化後) | 備考 |
|---|---|---|
| Q1-1 | `"42"` | 仮値 |
| Q1-2 | `"7"` | 仮値 |
| Q2 | `"coffeecup"` | `design.md` 記載 |
| Q3 keyword | `"hakidamenitsuru"` | 仮値 |
| Q3 code | `"2.24"` | √5 の有効数字 3 桁 |
| Q4 | `"29"` | `design.md` 記載 |

## 10. 初期実装で省略するもの

| 機能 | 初期実装 | 本実装(将来) |
|---|---|---|
| 音源 / AR ダウジング | ルート自体を作らず、回答正解後に直接 checkpoint へ遷移 | Web Audio API |
| AI ヒントチャット | 確認モーダル → 設問ごとの固定ヒント | LLM 連携の段階ヒント |
| NFC タッチ | 会場 QR で checkpoint URL を開く方式に統一 | Web NFC API |
| QR 生成 | 運営ダッシュボードで開始 URL を表示するのみ | アプリ内 QR 生成 |

## 11. テスト観点

- `normalize` の各正規化ルール(unit)
- `transitions.ts` の各遷移関数(unit、`docs/specs.md` の受け入れ条件と対応)
  - Q1 順序固定(再開時に再抽選されない)
  - 未解放サブへの回答が拒否される
  - 回答正解だけでは Q1 サブ完了にならない
  - Q4 正解で `FAKE_END` 到達
  - `FAKE_END` 前のエピローグ閲覧が拒否される
- 共通ガード loader が未解放ステージへのアクセスをリダイレクトする(integration、必要に応じて)
