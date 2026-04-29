import { createContext, useContext } from "react";
import type { UsePrinterReturn } from "./usePrinter";

export type PrinterContextValue = {
  printer: UsePrinterReturn;
  assetsReady: boolean;
  assetError: string | null;
};

export const PrinterContext = createContext<PrinterContextValue | null>(null);

export function usePrinterContext(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error("usePrinterContext must be used inside <PrinterProvider>");
  }
  return ctx;
}
