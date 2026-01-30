import React, { createContext, useContext, useState, useRef } from 'react';
import { ReceiptItemType } from '../components/Item';

interface ReceiptContextType {
  receiptItems: ReceiptItemType[];
  setReceiptItems: React.Dispatch<React.SetStateAction<ReceiptItemType[]>>;
  receiptItemsRef: React.RefObject<ReceiptItemType[]>;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptProvider({ children }: { children: React.ReactNode }) {
  const [receiptItems, setReceiptItems] = useState<ReceiptItemType[]>([
    { id: 1, name: 'Burger', price: '12.99', userTags: [] },
  ]);

  const receiptItemsRef = useRef(receiptItems);
  receiptItemsRef.current = receiptItems;

  return (
    <ReceiptContext.Provider value={{ receiptItems, setReceiptItems, receiptItemsRef }}>
      {children}
    </ReceiptContext.Provider>
  );
}

export function useReceipt() {
  const context = useContext(ReceiptContext);
  if (!context) {
    throw new Error('useReceipt must be used within ReceiptProvider');
  }
  return context;
}
