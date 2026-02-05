import React, { createContext, useContext, useState, useRef, useMemo } from 'react';
import { ReceiptItemData } from '@shared/types';

interface ReceiptItemsContextType {
  items: ReceiptItemData[];
  setItems: React.Dispatch<React.SetStateAction<ReceiptItemData[]>>;
}

const ReceiptItemsContext = createContext<ReceiptItemsContextType | undefined>(undefined);

export function ReceiptItemsProvider({ children }: { children: React.ReactNode }) {
  const [receiptItems, setReceiptItems] = useState<ReceiptItemData[]>([]);

  const value = useMemo<ReceiptItemsContextType>(
    () => ({ items: receiptItems, setItems: setReceiptItems }),
    [receiptItems]
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
