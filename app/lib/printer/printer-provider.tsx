import { useEffect, useMemo, useState } from "react";
import type { Font } from "bdfparser";
import { loadBdfFont } from "./bdf-font";
import { PrinterContext } from "./printer-context";
import { usePrinter } from "./usePrinter";

/**
 * Owns the LXD02Printer instance and BDF font for the operator section.
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
  const [font, setFont] = useState<Font | null>(null);
  const [fontError, setFontError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBdfFont()
      .then((f) => {
        if (!cancelled) setFont(f);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFontError(err instanceof Error ? err.message : String(err));
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
      },
      font,
      fontError,
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
      font,
      fontError,
    ],
  );

  return (
    <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>
  );
}
