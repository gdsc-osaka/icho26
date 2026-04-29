import { useCallback, useEffect, useRef } from "react";
import { drizzle } from "drizzle-orm/d1";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import {
  ErrorAlert,
  GlowButton,
  PrinterPanel,
  StageHeader,
  SystemPanel,
  TextInput,
} from "~/components";
import { listUsers } from "~/lib/operator/queries";
import { requireOperatorSession } from "~/lib/operator/session";
import { createUser } from "~/lib/shared/users";
import { useLocalStorageBoolean } from "~/lib/hooks/useLocalStorageBoolean";
import { usePrinterContext } from "~/lib/printer/printer-context";
import type { Route } from "./+types/operator.dashboard";

const COMPANY_NAME = "ZEUS Inc.";
const AUTO_PRINT_STORAGE_KEY = "operator.autoPrint";

export function meta() {
  return [{ title: "Operator Dashboard | icho26" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = drizzle(env.DB, { schema });
  const users = await listUsers(db);
  return { users };
}

type ActionResult =
  | {
      ok: true;
      issuedGroupId: string;
      groupName: string;
      groupSize: number;
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
    await createUser(db, groupId, new Date().toISOString(), {
      groupName,
      groupSize,
    });
    return { ok: true, issuedGroupId: groupId, groupName, groupSize };
  }

  return null;
}

export default function OperatorDashboard() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const { printer, font, fontError } = usePrinterContext();
  const [autoPrintEnabled, setAutoPrintEnabled] = useLocalStorageBoolean(
    AUTO_PRINT_STORAGE_KEY,
    true,
  );
  const lastPrintedRef = useRef<string | null>(null);
  const lastResetRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleReprint = useCallback(() => {
    if (!actionData?.ok || !font) return;
    const issued = actionData;
    const startUrl = `${window.location.origin}/start/${issued.issuedGroupId}`;
    const print = () =>
      printer.printBadge(
        {
          companyName: COMPANY_NAME,
          groupName: issued.groupName,
          groupSize: issued.groupSize,
          qrUrl: startUrl,
        },
        font,
      );
    if (printer.status.isConnected) {
      void print().catch(() => {});
    } else {
      // Synchronously kick off connect on this user gesture, then chain print.
      void printer
        .connect()
        .then(print)
        .catch(() => {});
    }
  }, [actionData, font, printer]);

  useEffect(() => {
    if (!actionData?.ok) return;
    if (lastResetRef.current === actionData.issuedGroupId) return;
    lastResetRef.current = actionData.issuedGroupId;

    formRef.current?.reset();
    const nameInput = formRef.current?.elements.namedItem("group_name");
    if (nameInput instanceof HTMLInputElement) nameInput.focus();
  }, [actionData]);

  useEffect(() => {
    if (!actionData?.ok) return;
    if (!autoPrintEnabled) return;
    if (!font) return;
    if (!printer.status.isConnected) return;
    if (lastPrintedRef.current === actionData.issuedGroupId) return;

    lastPrintedRef.current = actionData.issuedGroupId;
    const startUrl = `${window.location.origin}/start/${actionData.issuedGroupId}`;
    void printer.printBadge(
      {
        companyName: COMPANY_NAME,
        groupName: actionData.groupName,
        groupSize: actionData.groupSize,
        qrUrl: startUrl,
      },
      font,
    );
  }, [actionData, font, printer, autoPrintEnabled]);

  return (
    <main className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <StageHeader title="OPERATOR DASHBOARD">進捗一覧</StageHeader>
          <Form method="post" action="/operator/login?action=logout">
            <GlowButton type="submit">LOGOUT</GlowButton>
          </Form>
        </header>

        <SystemPanel>
          <div className="space-y-4">
            <h2 className="font-display text-lg text-text-primary">
              新規 ID 発行
            </h2>

            <PrinterPanel printer={printer} fontReady={font !== null} />
            {fontError && (
              <ErrorAlert>フォントロード失敗: {fontError}</ErrorAlert>
            )}

            <label className="flex items-center gap-2 font-mono text-sm text-text-primary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPrintEnabled}
                onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              発行時に自動印刷する
            </label>

            <Form
              method="post"
              className="space-y-3"
              ref={formRef}
              onSubmit={() => {
                if (autoPrintEnabled && !printer.status.isConnected) {
                  // Fire the Web Bluetooth picker on this user-gesture click;
                  // run alongside the form submission so the action's DB write
                  // is not blocked. The auto-print effect waits for the
                  // resulting connection before sending the badge.
                  void printer.connect().catch(() => {
                    // errors surfaced via printer.errorMessage in PrinterPanel
                  });
                }
              }}
            >
              <input type="hidden" name="_action" value="create-user" />
              <FormField label="社員名 (グループ名)">
                <TextInput
                  name="group_name"
                  required
                  maxLength={32}
                  placeholder="例: 営業二課"
                  className="w-full"
                />
              </FormField>
              <FormField label="グループ人数">
                <TextInput
                  type="number"
                  name="group_size"
                  required
                  min={1}
                  max={20}
                  placeholder="1"
                  className="w-full"
                />
              </FormField>
              {actionData && !actionData.ok && (
                <ErrorAlert>{actionData.error}</ErrorAlert>
              )}
              {autoPrintEnabled && !printer.status.isConnected && (
                <p className="text-text-secondary text-xs font-mono">
                  ※ 発行時にプリンタ未接続の場合、Bluetooth デバイス選択ダイアログが表示されます。
                </p>
              )}
              {!autoPrintEnabled && (
                <p className="text-text-secondary text-xs font-mono">
                  ※ 自動印刷オフ。詳細画面から手動で印刷してください。
                </p>
              )}
              <GlowButton type="submit">ID を発行</GlowButton>
            </Form>

            {actionData?.ok && (
              <IssuedIdCard
                groupId={actionData.issuedGroupId}
                groupName={actionData.groupName}
                groupSize={actionData.groupSize}
                printState={printer.printState}
                printerConnected={printer.status.isConnected}
                autoPrintEnabled={autoPrintEnabled}
                isConnecting={printer.isConnecting}
                fontReady={font !== null}
                onReprint={handleReprint}
              />
            )}
          </div>
        </SystemPanel>

        <SystemPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-text-secondary">
                <tr className="border-b border-accent-dim">
                  <th className="py-2 pr-4">groupId</th>
                  <th className="py-2 pr-4">グループ名</th>
                  <th className="py-2 pr-4">人数</th>
                  <th className="py-2 pr-4">stage</th>
                  <th className="py-2 pr-4">attempts</th>
                  <th className="py-2 pr-4">reported</th>
                  <th className="py-2 pr-4">updated</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-4 text-center text-text-secondary font-mono"
                    >
                      no groups yet
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.groupId} className="border-b border-accent-dim/30">
                    <td className="py-2 pr-4 font-mono text-text-primary break-all">
                      {u.groupId}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {u.groupName ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {u.groupSize ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-accent">
                      {u.currentStage}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {u.attemptCountTotal}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {u.reportedAt ? "✓" : "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-secondary text-xs">
                      {u.updatedAt}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/operator/group/${u.groupId}`}
                        className="text-accent hover:underline font-mono"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SystemPanel>
      </div>
    </main>
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
    <div className="space-y-1">
      <label className="block text-text-secondary text-xs font-mono">
        {label}
      </label>
      {children}
    </div>
  );
}

function IssuedIdCard({
  groupId,
  groupName,
  groupSize,
  printState,
  printerConnected,
  autoPrintEnabled,
  isConnecting,
  fontReady,
  onReprint,
}: {
  groupId: string;
  groupName: string;
  groupSize: number;
  printState: "idle" | "printing" | "success" | "error";
  printerConnected: boolean;
  autoPrintEnabled: boolean;
  isConnecting: boolean;
  fontReady: boolean;
  onReprint: () => void;
}) {
  const reprintDisabled =
    !fontReady || isConnecting || printState === "printing";
  const startUrl = `/start/${groupId}`;
  return (
    <div className="bg-bg-primary rounded p-3 font-mono text-sm space-y-2">
      <div className="text-accent">発行済み</div>
      <div className="space-y-1">
        <div className="text-text-secondary text-xs">groupId</div>
        <div className="text-text-primary break-all">{groupId}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-text-secondary text-xs">グループ名</div>
          <div className="text-text-primary">{groupName}</div>
        </div>
        <div>
          <div className="text-text-secondary text-xs">人数</div>
          <div className="text-text-primary">{groupSize}</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-text-secondary text-xs">開始 URL(相対)</div>
        <div className="text-text-primary break-all">{startUrl}</div>
      </div>
      {!autoPrintEnabled && (
        <p className="text-text-secondary text-xs">
          自動印刷オフ。詳細画面から手動で印刷してください。
        </p>
      )}
      {autoPrintEnabled && isConnecting && (
        <p className="text-accent text-xs">プリンタを接続中...</p>
      )}
      {autoPrintEnabled && !printerConnected && !isConnecting && (
        <p className="text-text-secondary text-xs">
          プリンタが接続されていません。詳細画面から再印刷できます。
        </p>
      )}
      {autoPrintEnabled && printerConnected && printState === "printing" && (
        <p className="text-accent text-xs">社員証を印刷中...</p>
      )}
      {autoPrintEnabled && printerConnected && printState === "success" && (
        <p className="text-accent text-xs">社員証を印刷しました</p>
      )}
      {autoPrintEnabled && printerConnected && printState === "error" && (
        <p className="text-danger text-xs">
          印刷に失敗しました。下記のボタンか詳細画面から再印刷してください。
        </p>
      )}
      <div className="pt-1">
        <GlowButton
          type="button"
          onClick={onReprint}
          disabled={reprintDisabled}
        >
          {printState === "printing" ? "印刷中..." : "このグループを再印刷"}
        </GlowButton>
      </div>
    </div>
  );
}
