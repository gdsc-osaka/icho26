import { useCallback, useEffect, useRef } from "react";
import { drizzle } from "drizzle-orm/d1";
import { Form, useActionData, useFetcher, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import { Icon } from "~/components";
import {
  CopyButton,
  LightPrinterPanel,
  OperatorShell,
} from "~/components/operator";
import { useLocalStorageBoolean } from "~/lib/hooks/useLocalStorageBoolean";
import { admitReservation, cancelReservation } from "~/lib/operator/mutations";
import {
  RESERVATION_SLOT_MINUTES,
  listWaitingReservations,
  type WaitingReservation,
} from "~/lib/operator/reservations";
import { requireOperatorSession } from "~/lib/operator/session";
import { usePrinterContext } from "~/lib/printer/printer-context";
import { createUser } from "~/lib/shared/users";
import type { Route } from "./+types/operator.issue";

const AUTO_PRINT_STORAGE_KEY = "operator.autoPrint";

export function meta() {
  return [{ title: "ID 発行 | Operator | icho26" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  await requireOperatorSession(request, db);
  const now = new Date().toISOString();
  const waitingReservations = await listWaitingReservations(db, now);
  return { waitingReservations };
}

type ActionResult =
  | {
      ok: true;
      issuedGroupId: string;
      groupName: string;
      groupSize: number;
      issuedAt: string;
      reserved: boolean;
    }
  | { ok: false; error: string };

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionResult | null> {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const session = await requireOperatorSession(request, db);

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");

  if (intent === "create-user" || intent === "reserve-user") {
    const groupName = String(formData.get("group_name") ?? "").trim();
    const groupSizeRaw = String(formData.get("group_size") ?? "").trim();
    const groupSize = Number(groupSizeRaw);

    if (!groupName) {
      return { ok: false, error: "グループ名は必須です" };
    }
    if (!Number.isInteger(groupSize) || groupSize <= 0) {
      return { ok: false, error: "人数は 1 以上の整数で入力してください" };
    }

    const groupId = `g_${crypto.randomUUID()}`;
    const issuedAt = new Date().toISOString();
    const reserved = intent === "reserve-user";
    await createUser(db, groupId, issuedAt, {
      groupName,
      groupSize,
      reservedAt: reserved ? issuedAt : null,
    });
    return {
      ok: true,
      issuedGroupId: groupId,
      groupName,
      groupSize,
      issuedAt,
      reserved,
    };
  }

  if (intent === "admit-reservation") {
    const groupId = String(formData.get("group_id") ?? "").trim();
    if (!groupId) return { ok: false, error: "groupId が指定されていません" };
    try {
      await admitReservation(db, {
        operatorId: session.operatorId,
        groupId,
        reasonCode: "OPERATOR_ADMIT",
        note: null,
        now: new Date().toISOString(),
      });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "入室処理に失敗しました",
      };
    }
    return null;
  }

  if (intent === "cancel-reservation") {
    const groupId = String(formData.get("group_id") ?? "").trim();
    if (!groupId) return { ok: false, error: "groupId が指定されていません" };
    try {
      await cancelReservation(db, {
        operatorId: session.operatorId,
        groupId,
        reasonCode: "OPERATOR_CANCEL",
        note: null,
        now: new Date().toISOString(),
      });
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "キャンセル処理に失敗しました",
      };
    }
    return null;
  }

  return null;
}

export default function OperatorIssue() {
  const { waitingReservations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { printer, assetsReady, assetError } = usePrinterContext();
  const [autoPrintEnabled, setAutoPrintEnabled] = useLocalStorageBoolean(
    AUTO_PRINT_STORAGE_KEY,
    true,
  );
  const lastPrintedRef = useRef<string | null>(null);
  const lastResetRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleReprint = useCallback(() => {
    if (!actionData?.ok) return;
    const issued = actionData;
    const startUrl = `${window.location.origin}/start/${issued.issuedGroupId}`;
    const print = () =>
      printer.printBadge({
        groupName: issued.groupName,
        groupSize: issued.groupSize,
        groupId: issued.issuedGroupId,
        issuedAt: new Date(issued.issuedAt),
        qrUrl: startUrl,
      });
    if (printer.status.isConnected) {
      void print().catch(() => {});
    } else {
      void printer
        .connect()
        .then(print)
        .catch(() => {});
    }
  }, [actionData, printer]);

  // 発行成功時に form を reset
  useEffect(() => {
    if (!actionData?.ok) return;
    if (lastResetRef.current === actionData.issuedGroupId) return;
    lastResetRef.current = actionData.issuedGroupId;
    formRef.current?.reset();
    const nameInput = formRef.current?.elements.namedItem("group_name");
    if (nameInput instanceof HTMLInputElement) nameInput.focus();
  }, [actionData]);

  // 自動印刷
  useEffect(() => {
    if (!actionData?.ok) return;
    if (!autoPrintEnabled) return;
    if (!assetsReady) return;
    if (!printer.status.isConnected) return;
    if (lastPrintedRef.current === actionData.issuedGroupId) return;

    lastPrintedRef.current = actionData.issuedGroupId;
    const startUrl = `${window.location.origin}/start/${actionData.issuedGroupId}`;
    void printer
      .printBadge({
        groupName: actionData.groupName,
        groupSize: actionData.groupSize,
        groupId: actionData.issuedGroupId,
        issuedAt: new Date(actionData.issuedAt),
        qrUrl: startUrl,
      })
      .catch(() => {});
  }, [actionData, assetsReady, printer, autoPrintEnabled]);

  return (
    <OperatorShell title="ID 発行" eyebrow="ISSUE">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 左: フォーム */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <Icon name="badge" className="text-base text-gray-700" />
            <h2 className="text-sm font-semibold text-gray-900">
              新規グループ ID 発行
            </h2>
          </header>

          <div className="space-y-5 p-4">
            <LightPrinterPanel printer={printer} assetsReady={assetsReady} />
            {assetError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                アセットロード失敗: {assetError}
              </div>
            )}

            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={autoPrintEnabled}
                onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              発行時に自動印刷する
            </label>

            <Form
              method="post"
              className="space-y-4"
              ref={formRef}
              onSubmit={() => {
                if (autoPrintEnabled && !printer.status.isConnected) {
                  void printer.connect().catch(() => {});
                }
              }}
            >
              <FormField label="社員名 (代表者の本名 or ニックネーム)">
                <input
                  name="group_name"
                  type="text"
                  required
                  maxLength={32}
                  placeholder="例: たかし、ヤマダ"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">
                  AI
                  チャットボットの呼び掛けに使うので、実際の名前やニックネームを入力してください。
                </p>
              </FormField>

              <FormField label="グループ人数">
                <input
                  type="number"
                  name="group_size"
                  required
                  min={1}
                  max={20}
                  placeholder="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </FormField>

              {actionData && !actionData.ok && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionData.error}
                </div>
              )}

              {autoPrintEnabled && !printer.status.isConnected && (
                <p className="text-xs text-gray-500">
                  ※ 発行時にプリンタ未接続の場合、Bluetooth
                  デバイス選択ダイアログが表示されます。
                </p>
              )}
              {!autoPrintEnabled && (
                <p className="text-xs text-gray-500">
                  ※ 自動印刷オフ。詳細画面から手動で印刷してください。
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="_action"
                  value="create-user"
                  className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  <Icon name="qr_code_2" className="text-base" />
                  ID を発行
                </button>
                <button
                  type="submit"
                  name="_action"
                  value="reserve-user"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                >
                  <Icon name="schedule" className="text-base" />
                  ID を予約発行
                </button>
              </div>
            </Form>
          </div>
        </section>

        {/* 右: 直近発行カード */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <Icon name="receipt_long" className="text-base text-gray-700" />
            <h2 className="text-sm font-semibold text-gray-900">直近発行</h2>
          </header>

          {actionData?.ok ? (
            <IssuedCard
              groupId={actionData.issuedGroupId}
              groupName={actionData.groupName}
              groupSize={actionData.groupSize}
              reserved={actionData.reserved}
              printState={printer.printState}
              printerConnected={printer.status.isConnected}
              autoPrintEnabled={autoPrintEnabled}
              isConnecting={printer.isConnecting}
              assetsReady={assetsReady}
              onReprint={handleReprint}
            />
          ) : (
            <div className="p-8 text-center text-sm text-gray-500">
              まだ発行されていません
            </div>
          )}
        </section>
      </div>

      <WaitingQueuePanel reservations={waitingReservations} />
    </OperatorShell>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function IssuedCard({
  groupId,
  groupName,
  groupSize,
  reserved,
  printState,
  printerConnected,
  autoPrintEnabled,
  isConnecting,
  assetsReady,
  onReprint,
}: {
  groupId: string;
  groupName: string;
  groupSize: number;
  reserved: boolean;
  printState: "idle" | "printing" | "success" | "error";
  printerConnected: boolean;
  autoPrintEnabled: boolean;
  isConnecting: boolean;
  assetsReady: boolean;
  onReprint: () => void;
}) {
  const reprintDisabled =
    !assetsReady || isConnecting || printState === "printing";
  const startUrl = `/start/${groupId}`;

  return (
    <div className="space-y-3 p-4 text-sm">
      <div
        className={`flex items-center gap-2 ${
          reserved ? "text-amber-600" : "text-emerald-600"
        }`}
      >
        <Icon
          name={reserved ? "schedule" : "check_circle"}
          filled
          className="text-base"
        />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          {reserved ? "RESERVED" : "ISSUED"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">
            グループ名
          </div>
          <div className="mt-0.5 text-gray-900">{groupName}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">
            人数
          </div>
          <div className="mt-0.5 text-gray-900">{groupSize}</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-gray-500">
          groupId
        </div>
        <div className="mt-1 flex items-center gap-2">
          <CopyButton value={groupId} />
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-gray-500">
          開始 URL (相対)
        </div>
        <div className="mt-1 break-all font-mono text-xs text-gray-700">
          {startUrl}
        </div>
      </div>

      <div className="space-y-1">
        {!autoPrintEnabled && (
          <p className="text-xs text-gray-500">
            自動印刷オフ。下記のボタンか詳細画面から手動で印刷してください。
          </p>
        )}
        {autoPrintEnabled && isConnecting && (
          <p className="text-xs text-blue-600">プリンタを接続中...</p>
        )}
        {autoPrintEnabled && !printerConnected && !isConnecting && (
          <p className="text-xs text-gray-500">
            プリンタが接続されていません。下記のボタンか詳細画面から再印刷できます。
          </p>
        )}
        {autoPrintEnabled && printerConnected && printState === "printing" && (
          <p className="text-xs text-blue-600">社員証を印刷中...</p>
        )}
        {autoPrintEnabled && printerConnected && printState === "success" && (
          <p className="text-xs text-emerald-600">社員証を印刷しました</p>
        )}
        {autoPrintEnabled && printerConnected && printState === "error" && (
          <p className="text-xs text-red-600">
            印刷に失敗しました。下記のボタンか詳細画面から再印刷してください。
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onReprint}
        disabled={reprintDisabled}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="print" className="text-base" />
        {printState === "printing" ? "印刷中..." : "このグループを再印刷"}
      </button>
    </div>
  );
}

function WaitingQueuePanel({
  reservations,
}: {
  reservations: WaitingReservation[];
}) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="hourglass_top" className="text-base text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">待機列</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-700">
            {reservations.length}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          slot {RESERVATION_SLOT_MINUTES} min
        </span>
      </header>

      {reservations.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          待機中の予約はありません
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {reservations.map((r) => (
            <WaitingRow key={r.groupId} reservation={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WaitingRow({ reservation }: { reservation: WaitingReservation }) {
  const admitFetcher = useFetcher<typeof action>();
  const cancelFetcher = useFetcher<typeof action>();
  const busy = admitFetcher.state !== "idle" || cancelFetcher.state !== "idle";
  const admitError =
    admitFetcher.data && admitFetcher.data.ok === false
      ? admitFetcher.data.error
      : null;
  const cancelError =
    cancelFetcher.data && cancelFetcher.data.ok === false
      ? cancelFetcher.data.error
      : null;

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 font-mono text-xs font-bold text-white">
          {reservation.position}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">
            {reservation.groupName ?? "(無名)"}
            <span className="ml-2 text-xs font-normal text-gray-500">
              {reservation.groupSize ?? "?"} 名
            </span>
          </div>
          <div className="font-mono text-[10px] text-gray-500">
            予約: {formatTime(reservation.reservedAt)} / 予想開始:{" "}
            {formatTime(reservation.estimatedStartAt)}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <div className="flex items-center gap-2">
          <admitFetcher.Form method="post">
            <input type="hidden" name="_action" value="admit-reservation" />
            <input type="hidden" name="group_id" value={reservation.groupId} />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="login" className="text-sm" />
              入室
            </button>
          </admitFetcher.Form>
          <cancelFetcher.Form method="post">
            <input type="hidden" name="_action" value="cancel-reservation" />
            <input type="hidden" name="group_id" value={reservation.groupId} />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="cancel" className="text-sm" />
              キャンセル
            </button>
          </cancelFetcher.Form>
        </div>
        {admitError && (
          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
            入室: {admitError}
          </div>
        )}
        {cancelError && (
          <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
            キャンセル: {cancelError}
          </div>
        )}
      </div>
    </li>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}
