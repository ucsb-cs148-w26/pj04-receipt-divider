/* ── Types ─────────────────────────────────────────────────────────── */

/** A value split into pre-tax price and tax components. */
export interface PriceTax {
  price: number;
  tax: number;
}

/**
 * The full balance breakdown for one user in a receipt room.
 *
 * - `totalUploadedAmount` — raw total of items + taxes from receipts this user uploaded.
 * - `ownClaimedAmount`    — this user's proportional share of items on their own receipts.
 * - `owedAmounts`         — what this user owes each other uploader (keyed by uploader profile ID).
 *
 * Derived values:
 *   participant card total  = sum(owedAmounts) + ownClaimedAmount   (price+tax)
 *   items page subtotal     = sum(owedAmounts.price) + ownClaimedAmount.price
 *   items page tax          = sum(owedAmounts.tax)   + ownClaimedAmount.tax
 *   "You Are Owed/You Owe"  = totalUploadedAmount − ownClaimedAmount − sum(owedAmounts)
 */
export interface UserBalance {
  totalUploadedAmount: PriceTax;
  ownClaimedAmount: PriceTax;
  owedAmounts: Map<string, PriceTax>;
}

/* ── Core cent-fair splitting ─────────────────────────────────────── */

/**
 * Splits `amount` among `claimCount` people using floor-based cent allocation.
 * Returns the share for the person at the given `rank` (1-based, where 1 =
 * earliest joiner among claimants). Later joiners (higher rank) receive any
 * remainder cents so that shares always sum exactly to `amount`.
 */
export function splitAmountByRank(
  amount: number,
  claimCount: number,
  rank: number,
): number {
  if (claimCount <= 1) return amount;

  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / claimCount);
  const remainderCents = totalCents - baseCents * claimCount;

  const extraCent = rank > claimCount - remainderCents ? 1 : 0;
  return (baseCents + extraCent) / 100;
}

/**
 * Calculates one participant's share of an item price using floor-based cent
 * allocation so that the shares always sum exactly to the item price.
 *
 * When `claimantIds` is provided the participant's rank among claimants is
 * computed from the sorted array (ascending = join order). Without it the
 * function falls back to treating `participantId` as the rank directly.
 *
 * Remainder cents are given to later joiners (higher rank).
 */
export function calculateParticipantShare(
  itemPrice: number,
  claimCount: number,
  participantId: number,
  claimantIds?: number[],
): number {
  if (claimCount <= 1) return itemPrice;

  let rank: number;
  if (claimantIds) {
    const sorted = [...claimantIds].sort((a, b) => a - b);
    rank = sorted.indexOf(participantId) + 1;
    if (rank === 0) return 0; // participant not among claimants
  } else {
    rank = participantId;
  }

  return splitAmountByRank(itemPrice, claimCount, rank);
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
    const claimantIds = item.userTags;
    const claimCount = claimantIds?.length || 1;
    const share = calculateParticipantShare(
      itemPrice,
      claimCount,
      participantId,
      claimantIds,
    );
    const discountFull = parseFloat(item.discount || '0') || 0;
    const discountShare =
      claimCount > 1
        ? splitAmountByRank(
            discountFull,
            claimCount,
            rankOf(participantId, claimantIds),
          )
        : discountFull;
    subtotal += share - discountShare;
  }

  let tax = 0;
  for (const item of participantItems) {
    const rid = item.receiptId ?? null;
    if (!rid) continue;
    const taxPerItem = getTax(rid);
    if (taxPerItem == null) continue;
    const claimantIds = item.userTags;
    const claimCount = claimantIds?.length || 1;
    tax += splitAmountByRank(
      taxPerItem,
      claimCount,
      rankOf(participantId, claimantIds),
    );
  }

  return { subtotal, tax, total: subtotal + tax };
}

/** Determine a participant's 1-based rank among claimants (sorted ascending). */
function rankOf(participantId: number, claimantIds?: number[]): number {
  if (!claimantIds || claimantIds.length <= 1) return 1;
  const sorted = [...claimantIds].sort((a, b) => a - b);
  const idx = sorted.indexOf(participantId);
  return idx < 0 ? 1 : idx + 1;
}

/* ── User Balance Calculation ─────────────────────────────────────── */

/**
 * Input data for `calculateUserBalance`. Mirrors the raw DB rows but
 * flattened to only the fields the calculation needs.
 */
export interface BalanceInput {
  /** All items in the group. */
  items: Array<{
    id: string;
    unitPrice: number;
    amount: number;
    receiptId: string | null;
    /** Profile IDs of everyone who claimed this item. */
    claimantProfileIds: string[];
  }>;
  /** All receipts in the group. */
  receipts: Array<{
    id: string;
    tax: number;
    uploaderId: string;
  }>;
  /** Profile IDs of all members, sorted by `joined_at` ascending (earliest first). */
  memberJoinOrder: string[];
  /** The profile ID of the user whose balance we are computing. */
  currentUserId: string;
}

/**
 * Computes the full financial balance for one user in a receipt room.
 *
 * All per-item splitting uses integer-cent arithmetic with remainder
 * pennies distributed to later joiners (higher index in `memberJoinOrder`).
 *
 * @returns `UserBalance` — see its doc-comment for how to derive every
 *   display value in the app from these three fields.
 */
export function calculateUserBalance(input: BalanceInput): UserBalance {
  const { items, receipts, memberJoinOrder, currentUserId } = input;

  // Build lookup maps
  const receiptById = new Map(receipts.map((r) => [r.id, r]));
  const myReceiptIds = new Set(
    receipts.filter((r) => r.uploaderId === currentUserId).map((r) => r.id),
  );

  // Count items per receipt (for splitting receipt tax evenly across items)
  const itemsPerReceipt = new Map<string, number>();
  for (const item of items) {
    if (item.receiptId) {
      itemsPerReceipt.set(
        item.receiptId,
        (itemsPerReceipt.get(item.receiptId) ?? 0) + 1,
      );
    }
  }

  // 1. totalUploadedAmount — raw totals from receipts the user uploaded
  let uploadedPrice = 0;
  let uploadedTax = 0;
  for (const item of items) {
    if (item.receiptId && myReceiptIds.has(item.receiptId)) {
      uploadedPrice += item.unitPrice * item.amount;
    }
  }
  for (const receipt of receipts) {
    if (receipt.uploaderId === currentUserId) {
      uploadedTax += receipt.tax;
    }
  }
  const totalUploadedAmount: PriceTax = {
    price: Math.round(uploadedPrice * 100) / 100,
    tax: Math.round(uploadedTax * 100) / 100,
  };

  // 2 & 3. Walk items claimed by the current user and split into
  //    ownClaimedAmount  (items on own receipts) vs
  //    owedAmounts       (items on others' receipts, keyed by uploader)
  let ownPrice = 0;
  let ownTax = 0;
  const owedMap = new Map<string, { price: number; tax: number }>();

  for (const item of items) {
    if (!item.claimantProfileIds.includes(currentUserId)) continue;

    const claimCount = item.claimantProfileIds.length;
    const rank = claimantRank(
      currentUserId,
      item.claimantProfileIds,
      memberJoinOrder,
    );
    const priceShare = splitAmountByRank(
      item.unitPrice * item.amount,
      claimCount,
      rank,
    );

    // Tax share for this item
    let taxShare = 0;
    if (item.receiptId) {
      const receipt = receiptById.get(item.receiptId);
      if (receipt && receipt.tax > 0) {
        const itemCount = itemsPerReceipt.get(item.receiptId) ?? 1;
        const taxPerItem = receipt.tax / itemCount;
        taxShare = splitAmountByRank(taxPerItem, claimCount, rank);
      }
    }

    const receipt = item.receiptId ? receiptById.get(item.receiptId) : null;
    const uploaderId = receipt?.uploaderId;

    if (uploaderId === currentUserId || !uploaderId) {
      // Item on own receipt (or no receipt) → ownClaimedAmount
      ownPrice += priceShare;
      ownTax += taxShare;
    } else {
      // Item on someone else's receipt → owedAmounts[uploaderId]
      const existing = owedMap.get(uploaderId) ?? { price: 0, tax: 0 };
      existing.price += priceShare;
      existing.tax += taxShare;
      owedMap.set(uploaderId, existing);
    }
  }

  const ownClaimedAmount: PriceTax = {
    price: Math.round(ownPrice * 100) / 100,
    tax: Math.round(ownTax * 100) / 100,
  };

  const owedAmounts = new Map<string, PriceTax>();
  for (const [uid, val] of owedMap) {
    owedAmounts.set(uid, {
      price: Math.round(val.price * 100) / 100,
      tax: Math.round(val.tax * 100) / 100,
    });
  }

  return { totalUploadedAmount, ownClaimedAmount, owedAmounts };
}

/**
 * Determine a user's 1-based rank among an item's claimants, ordered by
 * member join time (earliest joiner = rank 1, latest = highest rank).
 * Later joiners receive remainder pennies.
 */
function claimantRank(
  userId: string,
  claimantProfileIds: string[],
  memberJoinOrder: string[],
): number {
  if (claimantProfileIds.length <= 1) return 1;
  const sorted = [...claimantProfileIds].sort(
    (a, b) => memberJoinOrder.indexOf(a) - memberJoinOrder.indexOf(b),
  );
  const idx = sorted.indexOf(userId);
  return idx < 0 ? 1 : idx + 1;
}

/* ── Convenience helpers for consuming UserBalance ────────────────── */

/** Sum all owedAmounts values into a single PriceTax. */
export function sumOwedAmounts(owedAmounts: Map<string, PriceTax>): PriceTax {
  let price = 0;
  let tax = 0;
  for (const val of owedAmounts.values()) {
    price += val.price;
    tax += val.tax;
  }
  return {
    price: Math.round(price * 100) / 100,
    tax: Math.round(tax * 100) / 100,
  };
}

/**
 * Net "You Are Owed" (positive) or "You Owe" (negative) amount.
 * = totalUploadedAmount − ownClaimedAmount − sum(owedAmounts)
 */
export function netOwedAmount(balance: UserBalance): number {
  const owed = sumOwedAmounts(balance.owedAmounts);
  return (
    Math.round(
      (balance.totalUploadedAmount.price +
        balance.totalUploadedAmount.tax -
        balance.ownClaimedAmount.price -
        balance.ownClaimedAmount.tax -
        owed.price -
        owed.tax) *
        100,
    ) / 100
  );
}
