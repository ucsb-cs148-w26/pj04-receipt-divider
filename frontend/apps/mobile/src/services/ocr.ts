import { randomUUID } from 'expo-crypto';
import { ReceiptItemData } from '@shared/types';

/** Shape of each item returned by the backend /receipt/scan endpoint. */
interface BackendReceiptItem {
  name: string;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  taxed: boolean;
  taxCode: string | null;
  taxRate: number | null;
  rawPrice: string;
}

interface BackendSuggestion {
  type: 'info' | 'warning' | 'error';
  message: string;
  suggestion: string;
}

interface BackendCheck {
  id: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

/** Full response from POST /receipt/scan */
export interface ReceiptScanResult {
  items: ReceiptItemData[];
  calculatedSubtotal: number;
  ocrSubtotal: number | null;
  ocrTax: number | null;
  ocrTotal: number | null;
  taxRate: number | null;
  confidence: number;
  checks: BackendCheck[];
  warnings: string[];
  suggestions: BackendSuggestion[];
}

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

/**
 * Send an image (by local file URI) to the backend OCR pipeline.
 * Uses React Native's native FormData URI upload — no base64 conversion needed.
 * Returns parsed items + confidence/suggestions metadata.
 */
export const scanReceipt = async (
  imageUri: string,
): Promise<ReceiptScanResult> => {
  const formData = new FormData();
  // React Native FormData accepts { uri, type, name } directly
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'receipt.jpg',
  } as unknown as Blob);

  const response = await fetch(`${BACKEND_URL}/receipt/scan`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Receipt scan failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  const items: ReceiptItemData[] = (data.items as BackendReceiptItem[]).map(
    (item) => ({
      id: randomUUID(),
      name: item.name,
      price: `$${item.finalPrice.toFixed(2)}`,
      userTags: [],
      discount:
        item.discount !== 0 ? `$${Math.abs(item.discount).toFixed(2)}` : '',
    }),
  );

  return {
    items,
    calculatedSubtotal: data.calculatedSubtotal,
    ocrSubtotal: data.ocrSubtotal,
    ocrTax: data.ocrTax,
    ocrTotal: data.ocrTotal,
    taxRate: data.taxRate,
    confidence: data.confidence,
    checks: data.checks,
    warnings: data.warnings,
    suggestions: data.suggestions,
  };
};

/**
 * Convenience wrapper that returns just items (backward-compatible URI-based API).
 */
export const extractItems = async (
  imageUri: string,
): Promise<ReceiptItemData[]> => {
  const result = await scanReceipt(imageUri);
  return result.items;
};
