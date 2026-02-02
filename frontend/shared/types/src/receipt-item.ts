export interface ReceiptItemData {
  id: number;
  name: string;
  price: string;
  userTags?: number[]; // Array of user indices that have this item in their basket
  discount?: string; // Optional discount amount
}
