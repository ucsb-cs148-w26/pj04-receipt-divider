import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  IconButton,
  calculateUserBalance,
  netOwedAmount,
  sendSMS,
  splitAmountByRank,
} from '@eezy-receipt/shared';
import type {
  PaidStatusDb,
  GroupMember,
  Item,
  ItemClaim,
  Receipt,
} from '@eezy-receipt/shared';
import { useGroupData } from '@/hooks';
import { useAuth } from '@/providers';
import {
  deleteGroup,
  updateGroupName,
  updateDebtStatus,
} from '@/services/groupApi';
import { supabase } from '@/services/supabase';

export type ReceiptDetailParams = {
  id: string;
  name: string;
  amount: string;
  tab?: 'groups' | 'people';
};

type PersonStatus = 'pending' | 'waiting' | 'completed' | 'unrequested';

interface Person {
  id: string;
  name: string;
  status: PersonStatus;
  amount: number;
  group?: string;
}

function mapDbPaidStatus(
  ps: 'verified' | 'pending' | 'requested' | 'unrequested' | undefined,
): PersonStatus {
  if (ps === 'verified') return 'completed';
  if (ps === 'pending') return 'waiting';
  if (ps === 'requested') return 'pending';
  return 'unrequested';
}

/** Build an SMS payment breakdown message for a guest participant. */
function buildGuestPaymentMessage(
  personId: string,
  personName: string,
  items: Item[],
  claims: ItemClaim[],
  receipts: Receipt[],
  members: GroupMember[],
  roomName: string,
): string {
  const memberJoinOrder = members.map((m) => m.profile_id);

  const claimantsPerItem = new Map<string, string[]>();
  for (const c of claims) {
    const list = claimantsPerItem.get(c.item_id) ?? [];
    list.push(c.profile_id);
    claimantsPerItem.set(c.item_id, list);
  }

  const receiptItemCount = new Map<string, number>();
  for (const item of items) {
    if (item.receipt_id) {
      receiptItemCount.set(
        item.receipt_id,
        (receiptItemCount.get(item.receipt_id) ?? 0) + 1,
      );
    }
  }
  const taxPerItem = new Map<string, number>();
  for (const item of items) {
    if (!item.receipt_id) continue;
    const receipt = receipts.find((r) => r.id === item.receipt_id);
    if (!receipt || receipt.tax == null || receipt.tax <= 0) continue;
    const count = receiptItemCount.get(item.receipt_id) ?? 1;
    taxPerItem.set(item.id, receipt.tax / count);
  }

  const personClaims = claims.filter((c) => c.profile_id === personId);
  let subtotal = 0;
  let taxTotal = 0;
  const lineItems: string[] = [];

  for (const claim of personClaims) {
    const item = items.find((i) => i.id === claim.item_id);
    if (!item) continue;
    const fullPrice = item.unit_price * (item.amount ?? 1);
    const claimants = claimantsPerItem.get(claim.item_id) ?? [personId];
    const sorted = [...claimants].sort(
      (a, b) => memberJoinOrder.indexOf(a) - memberJoinOrder.indexOf(b),
    );
    const rank = sorted.indexOf(personId) + 1;
    const share = splitAmountByRank(fullPrice, claimants.length, rank);
    subtotal += share;
    const perItemTax = taxPerItem.get(claim.item_id);
    if (perItemTax != null) {
      taxTotal += splitAmountByRank(perItemTax, claimants.length, rank);
    }
    const label =
      claimants.length > 1
        ? `${item.name ?? 'Item'} (shared)`
        : (item.name ?? 'Item');
    lineItems.push(`  ${label}: $${share.toFixed(2)}`);
  }

  const total = subtotal + taxTotal;
  const parts: string[] = [
    `Hi ${personName}! Here's your total from "${roomName}":`,
    '-------------------',
    ...lineItems,
    '-------------------',
    `Subtotal: $${subtotal.toFixed(2)}`,
  ];
  if (taxTotal > 0.005) parts.push(`Tax: $${taxTotal.toFixed(2)}`);
  parts.push(`Total: $${total.toFixed(2)}`);
  return parts.join('\n');
}

export default function ReceiptDetailScreen() {
  const params = useLocalSearchParams<ReceiptDetailParams>();
  const { id, name, tab } = params;

  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const {
    items,
    claims,
    members,
    receipts,
    profiles,
    debtStatuses,
    isLoaded,
    isFinished,
    refetch,
    createdBy,
  } = useGroupData(id ?? '');

  const isHost = !!createdBy && createdBy === currentUserId;

  // ── Per-creditor debts where I am the debtor ────────────────────────────────
  // localDebtOverrides: optimistic status updates for the "Your Debts" sub-list
  const [localDebtOverrides, setLocalDebtOverrides] = useState<
    Map<string, PaidStatusDb>
  >(new Map());

  // ── Centralised balance calculation ─────────────────────────────────────────
  const userBalance = useMemo(() => {
    const balanceItems = items.map((item) => ({
      id: item.id,
      unitPrice: item.unit_price,
      amount: typeof item.amount === 'number' ? item.amount : 1,
      receiptId: item.receipt_id ?? null,
      claimantProfileIds: claims
        .filter((c) => c.item_id === item.id)
        .map((c) => c.profile_id),
    }));
    const balanceReceipts = receipts.map((r) => ({
      id: r.id,
      tax: r.tax ?? 0,
      uploaderId: r.created_by,
    }));
    const memberJoinOrder = members.map((m) => m.profile_id);
    return calculateUserBalance({
      items: balanceItems,
      receipts: balanceReceipts,
      memberJoinOrder,
      currentUserId,
    });
  }, [items, claims, receipts, members, currentUserId]);

  const myDebtsAsDebtor = useMemo(() => {
    return Array.from(userBalance.owedAmounts.entries())
      .map(([creditorId, pt]) => {
        const amount = pt.price + pt.tax;
        const debtRecord = debtStatuses.find(
          (d) => d.debtor_id === currentUserId && d.creditor_id === creditorId,
        );
        const overriddenStatus = localDebtOverrides.get(creditorId);
        const paidStatus = (overriddenStatus ??
          debtRecord?.paid_status ??
          'unrequested') as PaidStatusDb;
        return {
          creditorId,
          creditorName:
            profiles[creditorId]?.username ?? creditorId.slice(0, 8),
          amount,
          paidStatus,
        };
      })
      .filter((d) => d.amount > 0);
  }, [userBalance, currentUserId, debtStatuses, profiles, localDebtOverrides]);

  // Aggregate debt status for the self row in the people list
  const myAggregateDebtStatus = useMemo((): PersonStatus => {
    if (myDebtsAsDebtor.length === 0) return 'completed';
    if (myDebtsAsDebtor.every((d) => d.paidStatus === 'verified'))
      return 'completed';
    if (myDebtsAsDebtor.some((d) => d.paidStatus === 'pending'))
      return 'waiting';
    if (myDebtsAsDebtor.some((d) => d.paidStatus === 'requested'))
      return 'pending';
    return 'unrequested';
  }, [myDebtsAsDebtor]);

  // ── People list ───────────────────────────────────────────────────────────
  // Build per-member data (from the creditor perspective: what does each person
  // owe ME?).  The self-entry uses the aggregate debtor status instead.
  const basePeople = useMemo((): Person[] => {
    return members.map((member) => {
      const memberClaims = claims.filter(
        (c) => c.profile_id === member.profile_id,
      );
      const memberAmount = memberClaims.reduce((sum, claim) => {
        const item = items.find((i) => i.id === claim.item_id);
        return sum + (item ? item.unit_price * claim.share : 0);
      }, 0);

      let status: PersonStatus;
      if (member.profile_id === currentUserId) {
        // Self: show aggregate across all my debts-as-debtor
        status = myAggregateDebtStatus;
      } else {
        // Others: show their debt status specifically to me (I am the creditor)
        const debtToMe = debtStatuses.find(
          (d) =>
            d.debtor_id === member.profile_id &&
            d.creditor_id === currentUserId,
        );
        status = mapDbPaidStatus(debtToMe?.paid_status as PaidStatusDb);
      }

      return {
        id: member.profile_id,
        name:
          profiles[member.profile_id]?.username ??
          member.profile_id.slice(0, 8),
        status,
        amount: memberAmount,
      };
    });
  }, [
    members,
    claims,
    items,
    profiles,
    debtStatuses,
    currentUserId,
    myAggregateDebtStatus,
  ]);

  // completedIds: members who have verified their payment to me (I am the creditor).
  // Kept as state so we can apply optimistic updates before the next refetch.
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // localStatusOverrides: optimistic request/cancel actions in the people list
  const [localStatusOverrides, setLocalStatusOverrides] = useState<
    Map<string, PersonStatus>
  >(new Map());

  // Re-sync completedIds whenever debtStatuses arrive (post-refetch)
  useEffect(() => {
    setCompletedIds(
      new Set(
        debtStatuses
          .filter(
            (d) =>
              d.creditor_id === currentUserId && d.paid_status === 'verified',
          )
          .map((d) => d.debtor_id),
      ),
    );
  }, [debtStatuses, currentUserId]);

  const persistVerify = async (
    debtorId: string,
    creditorId: string,
    verified: boolean,
  ) => {
    const newStatus = verified ? 'verified' : 'unrequested';
    try {
      await updateDebtStatus(id ?? '', debtorId, creditorId, newStatus);
      if (verified) {
        setCompletedIds((prev) => new Set(prev).add(debtorId));
      } else {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(debtorId);
          return next;
        });
        setLocalStatusOverrides((prev) => {
          const next = new Map(prev);
          next.delete(debtorId);
          return next;
        });
      }
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update status.',
      );
    }
  };

  const handleCheckboxPress = (person: {
    id: string;
    name: string;
    status: PersonStatus;
  }) => {
    if (person.status === 'completed') return;
    if (person.status === 'pending' || person.status === 'unrequested') {
      const msg =
        person.status === 'unrequested'
          ? `${person.name}'s payment hasn't been requested yet. Do you want to verify them anyway?`
          : `${person.name} hasn't paid yet. Do you want to verify them anyway?`;
      Alert.alert('Payment Not Received', msg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify Anyway',
          style: 'destructive',
          onPress: () => void persistVerify(person.id, currentUserId, true),
        },
      ]);
      return;
    }
    // status === 'waiting' — eligible to verify
    Alert.alert(
      'Verify Payment?',
      `Confirm that you have received payment from ${person.name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: () => void persistVerify(person.id, currentUserId, true),
        },
      ],
    );
  };

  const STATUS_ORDER: Record<PersonStatus, number> = {
    waiting: 0,
    pending: 1,
    unrequested: 2,
    completed: 3,
  };

  // Modal for requesting payment from a specific person
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    status: PersonStatus;
    amount: number;
  } | null>(null);

  const unclaimedItemCount = items.filter(
    (item) => !claims.some((c) => c.item_id === item.id),
  ).length;

  const handleRequestAction = async (
    person: { id: string; name: string; status: PersonStatus },
    action: 'request' | 'cancel' | 'rerequst',
  ) => {
    const newStatus: 'requested' | 'unrequested' =
      action === 'request' || action === 'rerequst'
        ? 'requested'
        : 'unrequested';
    setActionLoading(action);
    try {
      // debtor = person being requested, creditor = current user (me)
      await updateDebtStatus(id ?? '', person.id, currentUserId, newStatus);
      const uiStatus: PersonStatus =
        action === 'cancel' ? 'unrequested' : 'pending';
      setLocalStatusOverrides((prev) => new Map(prev).set(person.id, uiStatus));
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to update status.',
      );
    }
    setActionLoading(null);
    setSelectedPerson(null);
  };

  const handleNudge = async (person: { id: string; name: string }) => {
    setActionLoading('nudge');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ next_nudge: new Date().toISOString() })
        .eq('id', person.id);
      if (error) throw error;
      Alert.alert('Nudge Sent', `${person.name} will be reminded to pay soon.`);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to nudge.',
      );
    }
    setActionLoading(null);
    setSelectedPerson(null);
  };

  // ── Guest SMS payment request ─────────────────────────────────────────────────
  // Guests can't mark themselves as paid in-app, so we open an SMS with their
  // itemised total and immediately advance the status to "awaiting verification".
  const handleGuestSmsRequest = async (person: {
    id: string;
    name: string;
    amount: number;
  }) => {
    const message = buildGuestPaymentMessage(
      person.id,
      person.name,
      items,
      claims,
      receipts,
      members,
      roomName,
    );
    setActionLoading('request');
    const result = await sendSMS(message);
    if (result === 'sent' || result === 'unknown') {
      try {
        // Skip "requested" and go straight to "pending" (DB) = "waiting" (UI)
        // since guests cannot self-report payment.
        await updateDebtStatus(id ?? '', person.id, currentUserId, 'pending');
        setLocalStatusOverrides((prev) =>
          new Map(prev).set(person.id, 'waiting'),
        );
      } catch (err) {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'Failed to update status.',
        );
      }
    }
    setActionLoading(null);
    setSelectedPerson(null);
  };

  // ── Single-debt pay ──────────────────────────────────────────────────────────
  // Called from the "Your Debts" sub-list for each individual creditor.
  const handleSingleDebtPay = (
    creditorId: string,
    creditorName: string,
    amount: number,
    currentStatus: PaidStatusDb,
  ) => {
    if (currentStatus === 'verified') return;

    if (currentStatus === 'pending') {
      // Already self-reported — offer to unmark
      Alert.alert(
        'Unmark Payment?',
        `Your payment to ${creditorName} is awaiting their verification. Do you want to unmark it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unmark',
            style: 'destructive',
            onPress: async () => {
              try {
                await updateDebtStatus(
                  id ?? '',
                  currentUserId,
                  creditorId,
                  'requested',
                );
                setLocalDebtOverrides((prev) =>
                  new Map(prev).set(creditorId, 'requested'),
                );
              } catch (err) {
                Alert.alert(
                  'Error',
                  err instanceof Error
                    ? err.message
                    : 'Failed to update status.',
                );
              }
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Mark as Paid?',
      `This will notify ${creditorName} that you've paid $${amount.toFixed(2)}. They will need to verify receipt of payment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          onPress: async () => {
            try {
              await updateDebtStatus(
                id ?? '',
                currentUserId,
                creditorId,
                'pending',
              );
              // Notify the creditor immediately by resetting their nudge timer
              void supabase
                .from('profiles')
                .update({ next_nudge: new Date().toISOString() })
                .eq('id', creditorId);
              setLocalDebtOverrides((prev) =>
                new Map(prev).set(creditorId, 'pending'),
              );
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to update status.',
              );
            }
          },
        },
      ],
    );
  };

  // All members with updated status, current user excluded from ordering/counts
  const allPeople = basePeople.map((p) => ({
    ...p,
    status: completedIds.has(p.id)
      ? ('completed' as PersonStatus)
      : localStatusOverrides.has(p.id)
        ? localStatusOverrides.get(p.id)!
        : p.status,
  }));

  const otherPeople = allPeople
    .filter((p) => p.id !== currentUserId)
    .sort((a, b) => {
      // Host always first
      if (a.id === createdBy) return -1;
      if (b.id === createdBy) return 1;
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    });

  const selfPerson = allPeople.find((p) => p.id === currentUserId);

  // people shown in list: others first (sorted), self pinned to bottom
  const people = selfPerson ? [...otherPeople, selfPerson] : otherPeople;

  // Per-person: how much each member owes ME (computed via calculateUserBalance for each member)
  const amountOwedToMePerPerson = useMemo(() => {
    const result = new Map<string, number>();
    const memberJoinOrder = members.map((m) => m.profile_id);
    const balanceItems = items.map((item) => ({
      id: item.id,
      unitPrice: item.unit_price,
      amount: typeof item.amount === 'number' ? item.amount : 1,
      receiptId: item.receipt_id ?? null,
      claimantProfileIds: claims
        .filter((c) => c.item_id === item.id)
        .map((c) => c.profile_id),
    }));
    const balanceReceipts = receipts.map((r) => ({
      id: r.id,
      tax: r.tax ?? 0,
      uploaderId: r.created_by,
    }));
    for (const member of members) {
      if (member.profile_id === currentUserId) continue;
      const memberBalance = calculateUserBalance({
        items: balanceItems,
        receipts: balanceReceipts,
        memberJoinOrder,
        currentUserId: member.profile_id,
      });
      // How much this member owes ME = their owedAmounts entry for me
      const owedToMe = memberBalance.owedAmounts.get(currentUserId);
      result.set(
        member.profile_id,
        owedToMe ? owedToMe.price + owedToMe.tax : 0,
      );
    }
    return result;
  }, [items, claims, receipts, members, currentUserId]);

  // Counts / fractions exclude the current user and members who don't owe anything
  const relevantPeople = otherPeople.filter(
    (p) => (amountOwedToMePerPerson.get(p.id) ?? 0) > 0,
  );
  const completedCount = relevantPeople.filter(
    (p) => p.status === 'completed',
  ).length;
  const waitingCount = relevantPeople.filter(
    (p) => p.status === 'waiting',
  ).length;
  const pendingCount = relevantPeople.filter(
    (p) => p.status === 'pending',
  ).length;
  const unrequestedCount = relevantPeople.filter(
    (p) => p.status === 'unrequested',
  ).length;
  const total = relevantPeople.length;

  const completedFraction = total > 0 ? completedCount / total : 0;
  const waitingFraction = total > 0 ? waitingCount / total : 0;
  const pendingFraction = total > 0 ? pendingCount / total : 0;
  const unrequestedFraction = total > 0 ? unrequestedCount / total : 0;

  // Verified-paid amount: sum of what verified members owe me
  const verifiedPaidAmount = [...completedIds].reduce(
    (sum, memberId) => sum + (amountOwedToMePerPerson.get(memberId) ?? 0),
    0,
  );
  // Amounts I've been verified as having paid to my creditors — reduces "You Owe"
  const myVerifiedPaymentsAsDebtor = myDebtsAsDebtor
    .filter((d) => d.paidStatus === 'verified')
    .reduce((sum, d) => sum + d.amount, 0);
  const displayAmount =
    netOwedAmount(userBalance) -
    verifiedPaidAmount +
    myVerifiedPaymentsAsDebtor;

  const statusParts: string[] = [];
  if (waitingCount > 0)
    statusParts.push(`${waitingCount} Awaiting Verification`);
  if (pendingCount > 0) statusParts.push(`${pendingCount} Requested & Unpaid`);
  if (unrequestedCount > 0)
    statusParts.push(`${unrequestedCount} Not Yet Requested`);

  // When user owes, progress bar reflects how many creditors have been paid
  const isZeroBalance = Math.abs(displayAmount) < 0.005;
  const userOwes = displayAmount < -0.005;
  // Only treat zero balance as "fully completed" if the room is actually finished;
  // while still in progress, fall through to the real group fractions
  const effectiveZero = isZeroBalance && isFinished;

  // Per-creditor counts for the bar when the user owes
  const myDebtorTotal = myDebtsAsDebtor.length;
  const myDebtorCompletedCount = myDebtsAsDebtor.filter(
    (d) => d.paidStatus === 'verified',
  ).length;
  const myDebtorWaitingCount = myDebtsAsDebtor.filter(
    (d) => d.paidStatus === 'pending',
  ).length;
  const myDebtorPendingCount = myDebtsAsDebtor.filter(
    (d) => d.paidStatus === 'requested',
  ).length;
  const myDebtorUnrequestedCount = myDebtsAsDebtor.filter(
    (d) => d.paidStatus === 'unrequested',
  ).length;

  const barCompletedFraction = effectiveZero
    ? 1
    : userOwes
      ? myDebtorTotal > 0
        ? myDebtorCompletedCount / myDebtorTotal
        : 0
      : completedFraction;
  const barWaitingFraction = effectiveZero
    ? 0
    : userOwes
      ? myDebtorTotal > 0
        ? myDebtorWaitingCount / myDebtorTotal
        : 0
      : waitingFraction;
  const barPendingFraction = effectiveZero
    ? 0
    : userOwes
      ? myDebtorTotal > 0
        ? myDebtorPendingCount / myDebtorTotal
        : 0
      : pendingFraction;
  const barUnrequestedFraction = effectiveZero
    ? 0
    : userOwes
      ? myDebtorTotal > 0
        ? myDebtorUnrequestedCount / myDebtorTotal
        : 0
      : unrequestedFraction;
  const barCompletedCount = effectiveZero
    ? 1
    : userOwes
      ? myDebtorCompletedCount
      : completedCount;
  const barTotal = effectiveZero ? 1 : userOwes ? myDebtorTotal : total;
  const myDebtorStatusParts: string[] = [];
  if (myDebtorWaitingCount > 0)
    myDebtorStatusParts.push(`${myDebtorWaitingCount} Awaiting Verification`);
  if (myDebtorPendingCount > 0)
    myDebtorStatusParts.push(`${myDebtorPendingCount} Payment Requested`);
  if (myDebtorUnrequestedCount > 0)
    myDebtorStatusParts.push(`${myDebtorUnrequestedCount} Not Yet Paid`);
  const barStatusParts = effectiveZero
    ? []
    : userOwes
      ? myDebtorStatusParts
      : statusParts;

  const [roomName, setRoomName] = useState(name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, []),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const isLoading = !isLoaded;

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header */}
      <View className='flex-row items-center px-5 pt-2 pb-3'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
        <View className='flex-1 flex-row items-center justify-center gap-2 mx-2'>
          {isHost && editingName ? (
            <TextInput
              value={roomName}
              onChangeText={setRoomName}
              autoFocus
              returnKeyType='done'
              onEndEditing={(e) => {
                const trimmed = e.nativeEvent.text.trim();
                setEditingName(false);
                if (id && trimmed) {
                  setRoomName(trimmed);
                  updateGroupName(id, trimmed).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Save Failed',
                      'Could not save the group name. Please try again.',
                    );
                  });
                }
              }}
              className='text-foreground text-xl font-bold text-center border-b border-border flex-1'
            />
          ) : (
            <Pressable
              onPress={() => isHost && setEditingName(true)}
              className='flex-row items-center gap-2'
              accessibilityLabel={isHost ? 'Edit room name' : undefined}
            >
              <Text
                className='text-foreground text-xl font-bold'
                numberOfLines={1}
              >
                {roomName}
              </Text>
              {isHost && (
                <MaterialCommunityIcons
                  name='pencil-outline'
                  size={18}
                  className='text-muted-foreground'
                />
              )}
            </Pressable>
          )}
        </View>
        <View className='w-9' />
      </View>

      <ScrollView
        className='flex-1 px-5'
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* You Are Owed / You Owe card */}
        <View className='bg-card rounded-2xl p-5 mb-4'>
          <Text className='text-muted-foreground text-sm mb-1'>
            {displayAmount >= 0 ? 'You Are Owed' : 'You Owe'}
          </Text>
          <Text
            className={`text-3xl font-bold mb-3 ${displayAmount >= 0 ? 'text-amount-positive' : 'text-amount-negative'}`}
          >
            ${Math.abs(displayAmount).toFixed(2)}
          </Text>

          {/* Status summary row */}
          <View className='flex-row items-center justify-between mb-2'>
            <Text className='text-muted-foreground text-sm'>
              {barStatusParts.length > 0
                ? barStatusParts.join(', ')
                : isFinished
                  ? 'Completed'
                  : 'In Progress'}
            </Text>
            <Text className='text-muted-foreground text-sm'>
              {barCompletedCount}/{barTotal}
            </Text>
          </View>

          {/* Progress bar */}
          <View className='h-2.5 bg-border rounded-full overflow-hidden flex-row'>
            {barCompletedFraction > 0 && (
              <View
                className='h-full bg-status-completed'
                style={{ flex: barCompletedFraction }}
              />
            )}
            {barWaitingFraction > 0 && (
              <View
                className='h-full bg-status-waiting'
                style={{ flex: barWaitingFraction }}
              />
            )}
            {barPendingFraction > 0 && (
              <View
                className='h-full bg-status-pending'
                style={{ flex: barPendingFraction }}
              />
            )}
            {barUnrequestedFraction > 0 && (
              <View
                className='h-full bg-status-unrequested'
                style={{ flex: barUnrequestedFraction }}
              />
            )}
            {barCompletedFraction +
              barWaitingFraction +
              barPendingFraction +
              barUnrequestedFraction <
              1 && (
              <View
                className='h-full bg-border'
                style={{
                  flex:
                    1 -
                    barCompletedFraction -
                    barWaitingFraction -
                    barPendingFraction -
                    barUnrequestedFraction,
                }}
              />
            )}
          </View>
        </View>

        {/* Your Debts — sub-list of per-creditor amounts the current user owes */}
        {myDebtsAsDebtor.length > 0 && (
          <View className='bg-card rounded-2xl overflow-hidden mb-4'>
            <View className='px-4 pt-4 pb-2 flex-row items-center justify-between'>
              <Text className='text-foreground font-semibold text-base'>
                Your Debts
              </Text>
              <Text className='text-muted-foreground text-xs'>
                {
                  myDebtsAsDebtor.filter((d) => d.paidStatus !== 'verified')
                    .length
                }{' '}
                outstanding
              </Text>
            </View>
            {myDebtsAsDebtor.map((debt, idx) => {
              const debtStatusLabel =
                debt.paidStatus === 'verified'
                  ? 'Paid & Verified'
                  : debt.paidStatus === 'pending'
                    ? 'Awaiting Verification'
                    : debt.paidStatus === 'requested'
                      ? 'Payment Requested — tap to pay'
                      : 'Not Yet Paid — tap to mark paid';
              const debtStatusColor =
                debt.paidStatus === 'verified'
                  ? 'text-status-completed'
                  : debt.paidStatus === 'pending'
                    ? 'text-status-waiting'
                    : debt.paidStatus === 'requested'
                      ? 'text-status-pending'
                      : 'text-status-unrequested';
              return (
                <View key={debt.creditorId}>
                  {idx > 0 && <View className='h-px bg-border mx-4' />}
                  <Pressable
                    className='flex-row items-center px-4 py-3 active:opacity-70'
                    onPress={() =>
                      handleSingleDebtPay(
                        debt.creditorId,
                        debt.creditorName,
                        debt.amount,
                        debt.paidStatus,
                      )
                    }
                    disabled={debt.paidStatus === 'verified'}
                  >
                    <View className='flex-1 mr-3'>
                      <Text
                        className='font-semibold text-base text-foreground'
                        numberOfLines={1}
                      >
                        {debt.creditorName}
                      </Text>
                      <Text className={`text-sm ${debtStatusColor}`}>
                        {debtStatusLabel}
                      </Text>
                    </View>
                    <Text className={`font-semibold mr-2 ${debtStatusColor}`}>
                      ${debt.amount.toFixed(2)}
                    </Text>
                    {debt.paidStatus === 'verified' ? (
                      <MaterialCommunityIcons
                        name='check-circle'
                        size={18}
                        className='text-status-completed'
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name='chevron-right'
                        size={18}
                        className='text-accent-dark'
                      />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* People / Receipts section */}
        <Text className='text-foreground text-lg font-semibold mb-2 px-1'>
          {tab === 'people' ? 'Receipts' : 'People'}
        </Text>
        <View className='bg-card rounded-2xl overflow-hidden'>
          {isLoading ? (
            <View className='p-8 items-center'>
              <ActivityIndicator />
            </View>
          ) : people.length === 0 ? (
            <View className='p-8 items-center'>
              <Text className='text-muted-foreground text-sm'>
                No members yet
              </Text>
            </View>
          ) : (
            people.map((person, index) => {
              const isSelf = person.id === currentUserId;
              const isPersonHost = person.id === createdBy;
              const owedToMeByPerson =
                amountOwedToMePerPerson.get(person.id) ?? 0;
              const borderColor = isSelf
                ? person.status === 'pending'
                  ? 'border-status-pending'
                  : person.status === 'waiting'
                    ? 'border-status-waiting'
                    : person.status === 'unrequested' &&
                        myDebtsAsDebtor.length > 0
                      ? 'border-status-unrequested'
                      : 'border-border'
                : person.status === 'completed'
                  ? 'border-status-completed'
                  : person.status === 'waiting'
                    ? 'border-status-waiting'
                    : person.status === 'pending'
                      ? 'border-status-pending'
                      : 'border-status-unrequested';
              const textColor = isSelf
                ? person.status === 'pending'
                  ? 'text-status-pending'
                  : 'text-muted-foreground'
                : person.status === 'completed'
                  ? 'text-muted-foreground line-through'
                  : person.status === 'waiting'
                    ? 'text-status-waiting'
                    : person.status === 'pending'
                      ? 'text-status-pending'
                      : 'text-status-unrequested';
              const statusLabel = isSelf
                ? ''
                : person.status === 'completed'
                  ? 'Paid & Verified'
                  : person.status === 'waiting'
                    ? 'Claimed, Awaiting Verification'
                    : person.status === 'pending'
                      ? 'Requested, Awaiting Payment'
                      : owedToMeByPerson > 0
                        ? 'Not Yet Requested'
                        : '';
              return (
                <View key={person.id}>
                  {index > 0 && <View className='h-px bg-border mx-4' />}
                  <Pressable
                    className='flex-row items-center px-4 py-3 active:opacity-70'
                    onPress={() => {
                      if (!isSelf && owedToMeByPerson > 0) {
                        setSelectedPerson({
                          id: person.id,
                          name: person.name,
                          status: person.status,
                          amount: owedToMeByPerson,
                        });
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <Pressable
                      onPress={() => {
                        if (!isSelf && owedToMeByPerson > 0) {
                          handleCheckboxPress(person);
                        }
                      }}
                      hitSlop={8}
                      disabled={
                        isSelf ||
                        (!isSelf &&
                          (person.status === 'completed' ||
                            owedToMeByPerson <= 0))
                      }
                      className={`w-7 h-7 rounded-full border-2 items-center justify-center mr-3 ${borderColor}`}
                    >
                      {person.status === 'completed' && !isSelf && (
                        <MaterialCommunityIcons
                          name='check'
                          size={16}
                          className='text-status-completed'
                        />
                      )}
                    </Pressable>

                    {/* Name + status */}
                    <View className='flex-1 mr-3'>
                      <Text
                        className={`font-semibold text-base ${textColor}`}
                        numberOfLines={1}
                      >
                        {tab === 'people'
                          ? (person.group ?? person.name)
                          : person.name}
                        {isSelf ? ' (You)' : ''}
                      </Text>
                      {!isSelf && isPersonHost && (
                        <Text className='text-primary text-xs font-semibold'>
                          Host
                        </Text>
                      )}
                      {statusLabel !== '' && (
                        <Text className='text-muted-foreground text-sm'>
                          {statusLabel}
                        </Text>
                      )}
                    </View>

                    {/* Amount */}
                    {!isSelf && owedToMeByPerson > 0 && (
                      <Text className={`font-semibold mr-1 ${textColor}`}>
                        {completedIds.has(person.id)
                          ? '$0.00'
                          : `+$${owedToMeByPerson.toFixed(2)}`}
                      </Text>
                    )}
                    {isSelf && myDebtsAsDebtor.length > 0 && (
                      <Text className={`font-semibold mr-1 ${textColor}`}>
                        $
                        {myDebtsAsDebtor
                          .reduce((s, d) => s + d.amount, 0)
                          .toFixed(2)}
                      </Text>
                    )}

                    {!isSelf && (
                      <MaterialCommunityIcons
                        name='chevron-right'
                        size={18}
                        className={
                          owedToMeByPerson <= 0
                            ? 'text-transparent'
                            : 'text-accent-dark'
                        }
                      />
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Go to Receipt Room */}
        <Button
          variant='outlined'
          size='large'
          className='mt-12 rounded-2xl w-full'
          disabled={isNavigating}
          onPress={() => {
            setIsNavigating(true);
            router.push({
              pathname: '/receipt-room',
              params: { roomId: id, items: '[]', participants: '[]' },
            });
          }}
        >
          View Receipt Room
        </Button>

        {/* Delete Room — host only */}
        {isHost && (
          <Pressable
            className='flex-row items-center justify-center gap-2 mt-4 py-3 active:opacity-70'
            onPress={() =>
              Alert.alert(
                'Delete Room',
                'This will permanently delete the room and all its receipts and items. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      deleteGroup(id ?? '')
                        .then(() => router.back())
                        .catch((err) =>
                          Alert.alert(
                            'Error',
                            err instanceof Error
                              ? err.message
                              : 'Could not delete the room.',
                          ),
                        );
                    },
                  },
                ],
              )
            }
          >
            <MaterialCommunityIcons
              name='delete-outline'
              size={20}
              color='#ef4444'
            />
            <Text className='text-red-500 text-base font-medium'>
              Delete Room
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Payment Request Modal ── */}
      <Modal
        transparent
        animationType='fade'
        visible={!!selectedPerson}
        onRequestClose={() => setSelectedPerson(null)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-end'
          onPress={() => setSelectedPerson(null)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-t-2xl p-6'>
              {selectedPerson && (
                <>
                  <Text className='text-foreground text-xl font-bold mb-1'>
                    {selectedPerson.name}
                  </Text>
                  <Text className='text-muted-foreground text-sm mb-4'>
                    Owes ${selectedPerson.amount.toFixed(2)}
                  </Text>

                  {/* Warning if receipt is not fully split */}
                  {unclaimedItemCount > 0 && (
                    <View className='bg-status-pending/10 border border-status-pending rounded-xl px-4 py-3 mb-4 flex-row items-start gap-3'>
                      <MaterialCommunityIcons
                        name='alert-outline'
                        size={18}
                        className='text-status-pending mt-0.5'
                      />
                      <Text className='text-status-pending text-sm flex-1'>
                        {unclaimedItemCount} item
                        {unclaimedItemCount !== 1 ? 's are' : ' is'} not yet
                        claimed. Amounts may change once all items are split.
                      </Text>
                    </View>
                  )}

                  {/* Action button based on status */}
                  {selectedPerson.status === 'unrequested' && (
                    <Pressable
                      className={`${
                        unclaimedItemCount > 0 ? 'bg-destructive' : 'bg-primary'
                      } rounded-2xl py-3.5 items-center active:opacity-80 mb-3`}
                      onPress={() =>
                        profiles[selectedPerson.id]?.isGuest
                          ? void handleGuestSmsRequest(selectedPerson)
                          : handleRequestAction(selectedPerson, 'request')
                      }
                      disabled={!!actionLoading}
                    >
                      {actionLoading === 'request' ? (
                        <ActivityIndicator color='white' />
                      ) : (
                        <Text className='text-primary-foreground font-semibold text-base'>
                          {profiles[selectedPerson.id]?.isGuest
                            ? 'Send SMS'
                            : unclaimedItemCount > 0
                              ? 'Request Money Anyway'
                              : 'Request Money'}
                        </Text>
                      )}
                    </Pressable>
                  )}

                  {selectedPerson.status === 'pending' && (
                    <>
                      <Pressable
                        className='bg-primary rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                        onPress={() =>
                          profiles[selectedPerson.id]?.isGuest
                            ? void handleGuestSmsRequest(selectedPerson)
                            : void handleNudge(selectedPerson)
                        }
                        disabled={!!actionLoading}
                      >
                        {actionLoading === 'nudge' ? (
                          <ActivityIndicator color='white' />
                        ) : (
                          <Text className='text-primary-foreground font-semibold text-base'>
                            {profiles[selectedPerson.id]?.isGuest
                              ? 'Re-send SMS'
                              : 'Nudge'}
                          </Text>
                        )}
                      </Pressable>
                      <Pressable
                        className='bg-destructive rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                        onPress={() =>
                          handleRequestAction(selectedPerson, 'cancel')
                        }
                        disabled={!!actionLoading}
                      >
                        {actionLoading === 'cancel' ? (
                          <ActivityIndicator color='white' />
                        ) : (
                          <Text className='text-destructive-foreground font-semibold text-base'>
                            Cancel Request
                          </Text>
                        )}
                      </Pressable>
                    </>
                  )}

                  {selectedPerson.status === 'waiting' && (
                    <>
                      <View className='bg-status-waiting/10 border border-status-waiting rounded-xl px-4 py-3 mb-3'>
                        <Text className='text-status-waiting text-sm text-center'>
                          {profiles[selectedPerson.id]?.isGuest
                            ? `SMS sent to ${selectedPerson.name}. Verify once you've received their payment.`
                            : `${selectedPerson.name} has logged a payment. If you haven't received it, you can re-request.`}
                        </Text>
                      </View>
                      <Pressable
                        className='bg-primary rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                        disabled={!!actionLoading}
                        onPress={() =>
                          Alert.alert(
                            'Verify Payment?',
                            `Confirm that you have received payment from ${selectedPerson.name}.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Verify',
                                onPress: async () => {
                                  setActionLoading('verify');
                                  await persistVerify(
                                    selectedPerson.id,
                                    currentUserId,
                                    true,
                                  );
                                  setActionLoading(null);
                                  setSelectedPerson(null);
                                },
                              },
                            ],
                          )
                        }
                      >
                        {actionLoading === 'verify' ? (
                          <ActivityIndicator color='white' />
                        ) : (
                          <Text className='text-primary-foreground font-semibold text-base'>
                            Verify Payment
                          </Text>
                        )}
                      </Pressable>
                      <Pressable
                        className='bg-destructive rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                        onPress={() =>
                          profiles[selectedPerson.id]?.isGuest
                            ? void handleGuestSmsRequest(selectedPerson)
                            : handleRequestAction(selectedPerson, 'rerequst')
                        }
                        disabled={!!actionLoading}
                      >
                        {actionLoading === 'rerequst' ? (
                          <ActivityIndicator color='white' />
                        ) : (
                          <Text className='text-primary-foreground font-semibold text-base'>
                            {profiles[selectedPerson.id]?.isGuest
                              ? 'Re-send SMS'
                              : 'Re-Request Payment'}
                          </Text>
                        )}
                      </Pressable>
                    </>
                  )}

                  {selectedPerson.status === 'completed' && (
                    <>
                      <View className='bg-status-completed/10 border border-status-completed rounded-xl px-4 py-3 mb-3'>
                        <Text className='text-status-completed text-sm text-center font-semibold'>
                          Payment Verified ✓
                        </Text>
                      </View>
                      <Pressable
                        className='bg-destructive rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                        onPress={() =>
                          Alert.alert(
                            'Unverify Payment?',
                            `This will mark ${selectedPerson.name}'s payment as unverified. They will need to re-mark their payment before you can verify again.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Unverify',
                                style: 'destructive',
                                onPress: () => {
                                  void persistVerify(
                                    selectedPerson.id,
                                    currentUserId,
                                    false,
                                  );
                                  setSelectedPerson(null);
                                },
                              },
                            ],
                          )
                        }
                      >
                        <Text className='text-destructive-foreground font-semibold text-base'>
                          Unverify Payment
                        </Text>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    className='py-3 items-center active:opacity-70'
                    onPress={() => setSelectedPerson(null)}
                  >
                    <Text className='text-muted-foreground text-base'>
                      Dismiss
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
