import { useCallback, useRef, useState } from "react";
import type { LXD02Printer, PrinterStatus } from "lx-printer/lx-d02";
import type { Font } from "bdfparser";
import { useLocalStorageNumber } from "../hooks/useLocalStorageNumber";
import { renderBadgeToCanvas, type BadgeArgs } from "./badge-renderer";

export type PrintState = "idle" | "printing" | "success" | "error";

export const DENSITY_STORAGE_KEY = "operator.printDensity";
export const DEFAULT_DENSITY = 4;
export const MIN_DENSITY = 1;
export const MAX_DENSITY = 7;

export type UsePrinterReturn = {
  status: PrinterStatus;
  printState: PrintState;
  errorMessage: string | null;
  isConnecting: boolean;
  density: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  setDensity: (next: number) => void;
  printBadge: (args: BadgeArgs, font: Font) => Promise<void>;
};

const initialStatus: PrinterStatus = {
  isConnected: false,
  isPrinting: false,
};

function clampDensity(n: number): number {
  if (!Number.isInteger(n)) return DEFAULT_DENSITY;
  if (n < MIN_DENSITY) return MIN_DENSITY;
  if (n > MAX_DENSITY) return MAX_DENSITY;
  return n;
}

export function usePrinter(): UsePrinterReturn {
  const printerRef = useRef<LXD02Printer | null>(null);
  const [status, setStatus] = useState<PrinterStatus>(initialStatus);
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [storedDensity, setStoredDensity] = useLocalStorageNumber(
    DENSITY_STORAGE_KEY,
    DEFAULT_DENSITY,
  );
  const density = clampDensity(storedDensity);

  const ensurePrinter = useCallback(async () => {
    if (printerRef.current) return printerRef.current;
    const { LXD02Printer: Ctor } = await import("lx-printer/lx-d02");
    const instance = new Ctor({
      onStatusChange: (next) => setStatus(next),
    });
    printerRef.current = instance;
    return instance;
  }, []);

  const connect = useCallback(async () => {
    setErrorMessage(null);
    setIsConnecting(true);
    try {
      const printer = await ensurePrinter();
      await printer.connect();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [ensurePrinter]);

  const disconnect = useCallback(() => {
    printerRef.current?.disconnect();
  }, []);

  // The hardware reports its density via async status notifications, but
  // the UI reflects the user's selection immediately by writing through
  // localStorage (useSyncExternalStore re-snapshots on the same render).
  // The hardware command runs in the background; failures surface as
  // errorMessage but do not roll back the UI value.
  const setDensity = useCallback(
    (next: number) => {
      const clamped = clampDensity(next);
      setStoredDensity(clamped);
      const inst = printerRef.current;
      if (inst) {
        void inst.setDensity(clamped).catch((err: unknown) => {
          setErrorMessage(err instanceof Error ? err.message : String(err));
        });
      }
    },
    [setStoredDensity],
  );

  const printBadge = useCallback(
    async (args: BadgeArgs, font: Font) => {
      setErrorMessage(null);
      setPrintState("printing");
      try {
        const printer = await ensurePrinter();
        const canvas = document.createElement("canvas");
        await renderBadgeToCanvas(canvas, args, font);
        await printer.print(canvas, { density });
        setPrintState("success");
      } catch (err) {
        setPrintState("error");
        setErrorMessage(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [ensurePrinter, density],
  );

  return {
    status,
    printState,
    errorMessage,
    isConnecting,
    density,
    connect,
    disconnect,
    setDensity,
    printBadge,
  };
}
