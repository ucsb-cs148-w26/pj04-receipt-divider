/**
 * Lightweight module-level store used to hand off photo URIs from the
 * Add Receipt screen back to the Receipt Room screen without route params.
 *
 * Usage:
 *  - add-receipt screen calls setPendingReceiptPhotos(uris) then router.back()
 *  - receipt-room screen calls takePendingReceiptPhotos() on focus
 */

let _pending: string[] | null = null;

export function setPendingReceiptPhotos(uris: string[]): void {
  _pending = [...uris];
}

/** Returns the pending URIs and clears the store, or null if nothing is pending. */
export function takePendingReceiptPhotos(): string[] | null {
  const p = _pending;
  _pending = null;
  return p;
}
