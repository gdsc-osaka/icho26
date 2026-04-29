import { useCallback, useRef, useState } from "react";
import type { LXD02Printer, PrinterStatus } from "lx-printer/lx-d02";
import type { Font } from "bdfparser";
import { renderBadgeToCanvas, type BadgeArgs } from "./badge-renderer";

export type PrintState = "idle" | "printing" | "success" | "error";

export type UsePrinterReturn = {
  status: PrinterStatus;
  printState: PrintState;
  errorMessage: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  printBadge: (args: BadgeArgs, font: Font) => Promise<void>;
};

const initialStatus: PrinterStatus = {
  isConnected: false,
  isPrinting: false,
};

export function usePrinter(): UsePrinterReturn {
  const printerRef = useRef<LXD02Printer | null>(null);
  const [status, setStatus] = useState<PrinterStatus>(initialStatus);
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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

  const printBadge = useCallback(
    async (args: BadgeArgs, font: Font) => {
      setErrorMessage(null);
      setPrintState("printing");
      try {
        const printer = await ensurePrinter();
        const canvas = document.createElement("canvas");
        await renderBadgeToCanvas(canvas, args, font);
        await printer.print(canvas, { density: 5 });
        setPrintState("success");
      } catch (err) {
        setPrintState("error");
        setErrorMessage(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [ensurePrinter],
  );

  return {
    status,
    printState,
    errorMessage,
    isConnecting,
    connect,
    disconnect,
    printBadge,
  };
}
