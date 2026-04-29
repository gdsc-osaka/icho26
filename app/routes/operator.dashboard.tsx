import { useCallback, useEffect, useRef } from "react";
import { drizzle } from "drizzle-orm/d1";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import * as schema from "../../db/schema";
import {
  BackgroundFX,
  ErrorAlert,
  GlowButton,
  Icon,
  PrinterPanel,
  StageHeader,
  SystemPanel,
  TextInput,
  TopBar,
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

    // Claim the slot before the await so subsequent re-renders (printer
    // status updates fire several times during a print) do not stack
    // additional printBadge() calls. On failure the error surfaces via
    // printer.printState / errorMessage and the operator can retry through
    // the "このグループを再印刷" button, which bypasses this guard.
    lastPrintedRef.current = actionData.issuedGroupId;
    const startUrl = `${window.location.origin}/start/${actionData.issuedGroupId}`;
    void printer
      .printBadge(
        {
          companyName: COMPANY_NAME,
          groupName: actionData.groupName,
          groupSize: actionData.groupSize,
          qrUrl: startUrl,
        },
        font,
      )
      .catch(() => {
        // Error is already surfaced via printer.errorMessage / printState.
      });
  }, [actionData, font, printer, autoPrintEnabled]);

  return (
    <>
      <TopBar sessionId="OPERATOR" rightIcon="admin_panel_settings" />
      <BackgroundFX />
      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pt-20 pb-12 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <StageHeader title="OPERATOR DASHBOARD" eyebrow="進捗一覧 / GROUPS" />
          <Form method="post" action="/operator/login?action=logout">
            <GlowButton type="submit">
              <span className="inline-flex items-center gap-2">
                <Icon name="logout" className="text-sm" /> LOGOUT
              </span>
            </GlowButton>
          </Form>
        </header>

        <SystemPanel>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Icon name="add_box" className="text-sm" />
              <h2 className="font-mono text-[10px] uppercase tracking-widest">
                NEW ID ISSUE
              </h2>
            </div>

            <PrinterPanel printer={printer} fontReady={font !== null} />
            {fontError && (
              <ErrorAlert>フォントロード失敗: {fontError}</ErrorAlert>
            )}

            <label className="flex cursor-pointer select-none items-center gap-2 font-mono text-sm text-on-surface">
              <input
                type="checkbox"
                checked={autoPrintEnabled}
                onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
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
              <FormField label="社員名 (代表者の本名 or ニックネーム)">
                <TextInput
                  name="group_name"
                  required
                  maxLength={32}
                  placeholder="例: たかし、ヤマダ"
                  className="w-full"
                />
                <p className="font-mono text-xs text-on-surface-variant">
                  AI
                  チャットボットの呼び掛けに使うので、実際の名前やニックネームを入力してください。
                </p>
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
                <p className="font-mono text-xs text-on-surface-variant">
                  ※ 発行時にプリンタ未接続の場合、Bluetooth
                  デバイス選択ダイアログが表示されます。
                </p>
              )}
              {!autoPrintEnabled && (
                <p className="font-mono text-xs text-on-surface-variant">
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
              <thead className="font-mono text-on-surface-variant">
                <tr className="border-b border-cyan-900/50">
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
                      className="py-4 text-center font-mono text-on-surface-variant"
                    >
                      no groups yet
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr
                    key={u.groupId}
                    className="border-b border-cyan-900/30 hover:bg-cyan-950/10"
                  >
                    <td className="break-all py-2 pr-4 font-mono text-on-surface">
                      {u.groupId}
                    </td>
                    <td className="py-2 pr-4 font-mono text-on-surface">
                      {u.groupName ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-on-surface">
                      {u.groupSize ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-cyan-400">
                      {u.currentStage}
                    </td>
                    <td className="py-2 pr-4 font-mono text-on-surface">
                      {u.attemptCountTotal}
                    </td>
                    <td className="py-2 pr-4 font-mono text-on-surface">
                      {u.reportedAt ? "✓" : "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-on-surface-variant">
                      {u.updatedAt}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/operator/group/${u.groupId}`}
                        className="font-mono text-cyan-400 hover:underline"
                      >
                        詳細 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SystemPanel>
      </main>
    </>
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
      <label className="block font-mono text-[10px] uppercase tracking-widest text-cyan-900">
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
    <div className="space-y-2 border border-cyan-400/40 bg-[#05070A]/80 p-3 font-mono text-sm">
      <div className="flex items-center gap-2 text-cyan-400">
        <Icon name="check_circle" filled className="text-sm" />
        <span className="text-[10px] uppercase tracking-widest">ISSUED</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-900">
            グループ名
          </div>
          <div className="text-on-surface">{groupName}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-900">
            人数
          </div>
          <div className="text-on-surface">{groupSize}</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-cyan-900">
          groupId
        </div>
        <div className="break-all text-on-surface">{groupId}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-cyan-900">
          開始 URL(相対)
        </div>
        <div className="break-all text-on-surface">{startUrl}</div>
      </div>
      {!autoPrintEnabled && (
        <p className="text-xs text-on-surface-variant">
          自動印刷オフ。下記のボタンか詳細画面から手動で印刷してください。
        </p>
      )}
      {autoPrintEnabled && isConnecting && (
        <p className="text-xs text-cyan-400">プリンタを接続中...</p>
      )}
      {autoPrintEnabled && !printerConnected && !isConnecting && (
        <p className="text-xs text-on-surface-variant">
          プリンタが接続されていません。下記のボタンか詳細画面から再印刷できます。
        </p>
      )}
      {autoPrintEnabled && printerConnected && printState === "printing" && (
        <p className="text-xs text-cyan-400">社員証を印刷中...</p>
      )}
      {autoPrintEnabled && printerConnected && printState === "success" && (
        <p className="text-xs text-cyan-400">社員証を印刷しました</p>
      )}
      {autoPrintEnabled && printerConnected && printState === "error" && (
        <p className="text-xs text-error">
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
