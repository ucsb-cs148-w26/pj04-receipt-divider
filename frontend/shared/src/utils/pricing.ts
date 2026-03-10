/**
 * Calculates one participant's share of an item price using floor-based cent
 * allocation so that the shares always sum exactly to the item price.
 *
 * Distributes any remainder cents to the participants whose IDs rank highest
 * (i.e. participantId > claimCount - remainderCents).
 *
 * @param itemPrice    The full price of the item (e.g. 0.01)
 * @param claimCount   How many participants share this item
 * @param participantId  The numeric ID of the participant (used as a rank for
 *                       penny distribution — must be in the range [1, claimCount])
 * @returns The participant's share rounded to the nearest cent
 */
export function calculateParticipantShare(
  itemPrice: number,
  claimCount: number,
  participantId: number,
): number {
  if (claimCount <= 1) return itemPrice;

  const percentage = 100 / claimCount;
  let share = Math.floor(itemPrice * percentage) / 100;

  const remainderCents = Math.trunc((itemPrice - share * claimCount) * 100);
  if (participantId > claimCount - remainderCents) {
    share += 0.01;
  }

  return share;
}

/**
 * Calculates a participant's subtotal, tax share, and combined total across
 * all items they have claimed.
 *
 * Uses the same floor-based cent-allocation as `calculateParticipantShare` so
 * the number shown on the receipt-room card is always identical to the total
 * shown on the participant's items page.
 *
 * @param participantId   Numeric participant ID (used for penny tie-breaking)
 * @param participantItems Items claimed by this participant (already filtered)
 * @param taxPerItemMap   Map/record of receiptId → tax ÷ item-count for that receipt
 */
export function calculateParticipantTotal(
  participantId: number,
  participantItems: Array<{
    price: string;
    discount?: string;
    userTags?: number[];
    receiptId?: string | null;
  }>,
  taxPerItemMap: Map<string, number> | Record<string, number>,
): { subtotal: number; tax: number; total: number } {
  const getTax = (rid: string): number | undefined =>
    taxPerItemMap instanceof Map
      ? taxPerItemMap.get(rid)
      : (taxPerItemMap as Record<string, number>)[rid];

  let subtotal = 0;
  for (const item of participantItems) {
    const itemPrice = parseFloat(item.price) || 0;
    const claimCount = item.userTags?.length || 1;
    const share = calculateParticipantShare(
      itemPrice,
      claimCount,
      participantId,
    );
    const discountFull = parseFloat(item.discount || '0') || 0;
    const discountShare =
      claimCount > 1 ? (discountFull * (100 / claimCount)) / 100 : discountFull;
    subtotal += share - discountShare;
  }

  let tax = 0;
  for (const item of participantItems) {
    const rid = item.receiptId ?? null;
    if (!rid) continue;
    const taxPerItem = getTax(rid);
    if (taxPerItem == null) continue;
    const claimCount = item.userTags?.length || 1;
    tax += taxPerItem / claimCount;
  }
  tax = Math.round(tax * 100) / 100;

  return { subtotal, tax, total: subtotal + tax };
}
