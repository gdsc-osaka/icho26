import { useEffect, useMemo, useState } from "react";
import { loadBackground } from "./background";
import { loadFontDateTime, loadFontUuidex } from "./bdf-font";
import { PrinterContext } from "./printer-context";
import { usePrinter } from "./usePrinter";
import { ensureNotoSansJp } from "./web-font";

/**
 * Owns the LXD02Printer instance and badge assets (background image,
 * BDF subsets, Noto Sans JP) for the operator section.
 *
 * Mounting this above the `<Outlet />` in `routes/operator.tsx` keeps the
 * Bluetooth connection alive across navigation between sibling operator
 * routes (dashboard ↔ group detail), since React Router 7 does not
 * unmount the layout when only the child route changes.
 */
export function PrinterProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const printer = usePrinter();
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  // Pre-warm the badge assets in parallel so the first print does not
  // block on font / image fetches and Web Bluetooth's transient
  // activation window stays intact when the operator clicks "ID を発行".
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadBackground(),
      loadFontUuidex(),
      loadFontDateTime(),
      ensureNotoSansJp(),
    ])
      .then(() => {
        if (!cancelled) setAssetsReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAssetError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-warm the lx-printer dynamic import so the user-gesture click
  // can reach requestDevice() inside the transient activation window
  // without waiting on a fresh module fetch.
  useEffect(() => {
    void import("lx-printer/lx-d02");
  }, []);

  // usePrinter() returns a fresh object each render. Re-build the
  // context value only when any of the relevant fields actually changed,
  // so deep consumers do not re-render on every render of this provider.
  const {
    status,
    printState,
    errorMessage,
    isConnecting,
    density,
    connect,
    disconnect,
    setDensity,
    printBadge,
    printCongestion,
  } = printer;

  // Tear down the GATT connection when the operator section unmounts
  // (logout, navigation away to /operator/login). disconnect() is a no-op
  // when the printer was never created or is already disconnected.
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = useMemo(
    () => ({
      printer: {
        status,
        printState,
        errorMessage,
        isConnecting,
        density,
        connect,
        disconnect,
        setDensity,
        printBadge,
        printCongestion,
      },
      assetsReady,
      assetError,
    }),
    [
      status,
      printState,
      errorMessage,
      isConnecting,
      density,
      connect,
      disconnect,
      setDensity,
      printBadge,
      printCongestion,
      assetsReady,
      assetError,
    ],
  );

  return (
    <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>
  );
}
