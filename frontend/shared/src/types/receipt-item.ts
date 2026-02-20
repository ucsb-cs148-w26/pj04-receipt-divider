export interface ReceiptItemData {
  id: string;
  name: string;
  price: string;
  userTags?: number[]; // Array of user indices that have this item in their basket
  discount?: string; // Optional discount amount
}
