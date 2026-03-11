export interface ReceiptItemData {
  id: string;
  name: string;
  price: string;
  userTags?: number[]; // Array of user indices that have this item in their basket
  discount?: string; // Optional discount amount
  receiptId?: string | null; // Which receipt this item belongs to (group rooms only)
  taxPct?: number; // Tax percentage applied to this item's price (e.g. 8.5 means 8.5%)
}
