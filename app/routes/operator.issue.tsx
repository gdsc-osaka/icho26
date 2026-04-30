import { useCallback, useEffect, useRef } from "react";
import { drizzle } from "drizzle-orm/d1";
import { Form, useActionData } from "react-router";
import * as schema from "../../db/schema";
import { Icon } from "~/components";
import {
  CopyButton,
  LightPrinterPanel,
  OperatorShell,
} from "~/components/operator";
import { useLocalStorageBoolean } from "~/lib/hooks/useLocalStorageBoolean";
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
  return null;
}

type ActionResult =
  | {
      ok: true;
      issuedGroupId: string;
      groupName: string;
      groupSize: number;
      issuedAt: string;
    }
  | { ok: false; error: string };

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionResult | null> {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  await requireOperatorSession(request, db);

  const formData = await request.formData();
  const intent = String(formData.get("_action") ?? "");

  if (intent === "create-user") {
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
    await createUser(db, groupId, issuedAt, {
      groupName,
      groupSize,
    });
    return {
      ok: true,
      issuedGroupId: groupId,
      groupName,
      groupSize,
      issuedAt,
    };
  }

  return null;
}

export default function OperatorIssue() {
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
              <input type="hidden" name="_action" value="create-user" />
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

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
              >
                <Icon name="qr_code_2" className="text-base" />
                ID を発行
              </button>
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
      <div className="flex items-center gap-2 text-emerald-600">
        <Icon name="check_circle" filled className="text-base" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          ISSUED
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
