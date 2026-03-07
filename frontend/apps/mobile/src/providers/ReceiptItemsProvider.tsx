import React, { createContext, useContext, useState, useMemo } from 'react';
import { ReceiptItemData } from '@shared/types';

export interface ReceiptScanMeta {
  calculatedSubtotal: number;
  ocrSubtotal: number | null;
  ocrTax: number | null;
  ocrTotal: number | null;
  taxRate: number | null;
  confidence: number;
  warnings: string[];
  suggestions: { type: string; message: string; suggestion: string }[];
}

interface ReceiptItemsContextType {
  items: ReceiptItemData[];
  setItems: React.Dispatch<React.SetStateAction<ReceiptItemData[]>>;
  scanMeta: ReceiptScanMeta | null;
  setScanMeta: React.Dispatch<React.SetStateAction<ReceiptScanMeta | null>>;
}

const ReceiptItemsContext = createContext<ReceiptItemsContextType | undefined>(
  undefined,
);

export function ReceiptItemsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [receiptItems, setReceiptItems] = useState<ReceiptItemData[]>([]);
  const [scanMeta, setScanMeta] = useState<ReceiptScanMeta | null>(null);

  const value = useMemo<ReceiptItemsContextType>(
    () => ({
      items: receiptItems,
      setItems: setReceiptItems,
      scanMeta,
      setScanMeta,
    }),
    [receiptItems, scanMeta],
  );

  return (
    <ReceiptItemsContext.Provider value={value}>
      {children}
    </ReceiptItemsContext.Provider>
  );
}

export function useReceiptItems() {
  const context = useContext(ReceiptItemsContext);
  if (!context) {
    throw new Error('useReceipt must be used within ReceiptProvider');
  }
  return context;
}
