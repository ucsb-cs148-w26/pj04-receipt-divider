import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Button, IconButton } from '@eezy-receipt/shared';
import { useGroupData } from '@/hooks';
import { useAuth } from '@/providers';
import {
  deleteGroup,
  updateGroupName,
  updatePaidStatus,
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
    isLoaded,
    refetch,
    createdBy,
  } = useGroupData(id ?? '');

  const isHost = !!createdBy && createdBy === currentUserId;

  // Build per-member data
  const basePeople = useMemo((): Person[] => {
    return members.map((member) => {
      const memberClaims = claims.filter(
        (c) => c.profile_id === member.profile_id,
      );
      const memberAmount = memberClaims.reduce((sum, claim) => {
        const item = items.find((i) => i.id === claim.item_id);
        return sum + (item ? item.unit_price * claim.share : 0);
      }, 0);
      return {
        id: member.profile_id,
        name:
          profiles[member.profile_id]?.username ??
          member.profile_id.slice(0, 8),
        status: mapDbPaidStatus(member.paid_status),
        amount: memberAmount,
      };
    });
  }, [members, claims, items, profiles]);

  // completedIds: initialized once from DB, then locally toggleable
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // localStatusOverrides: tracks request/cancel actions before next refetch
  const [localStatusOverrides, setLocalStatusOverrides] = useState<
    Map<string, PersonStatus>
  >(new Map());
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !members.length) return;
    initializedRef.current = true;
    setCompletedIds(
      new Set(
        members
          .filter((m) => m.paid_status === 'verified')
          .map((m) => m.profile_id),
      ),
    );
  }, [members]);

  const persistVerify = async (personId: string, verified: boolean) => {
    const newStatus = verified ? 'verified' : 'unrequested';
    try {
      await updatePaidStatus(id ?? '', personId, newStatus);
      if (verified) {
        setCompletedIds((prev) => new Set(prev).add(personId));
      } else {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(personId);
          return next;
        });
        setLocalStatusOverrides((prev) => {
          const next = new Map(prev);
          next.delete(personId);
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
          onPress: () => void persistVerify(person.id, true),
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
          onPress: () => void persistVerify(person.id, true),
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
      await updatePaidStatus(id ?? '', person.id, newStatus);
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

  const handleSelfPayToggle = async () => {
    if (!selfPerson) return;
    if (
      selfPerson.status === 'pending' ||
      selfPerson.status === 'unrequested'
    ) {
      // 'requested'/'unrequested' in DB → mark as paid sets DB to 'pending' → UI 'waiting'
      Alert.alert(
        'Mark as Paid?',
        'This will notify the host that you have paid. They will need to verify your payment.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as Paid',
            onPress: async () => {
              setIsSelfPayLoading(true);
              try {
                await updatePaidStatus(id ?? '', currentUserId, 'pending');
                setLocalStatusOverrides((prev) =>
                  new Map(prev).set(currentUserId, 'waiting'),
                );
              } catch (err) {
                Alert.alert(
                  'Error',
                  err instanceof Error
                    ? err.message
                    : 'Failed to update status.',
                );
              } finally {
                setIsSelfPayLoading(false);
              }
            },
          },
        ],
      );
    } else if (selfPerson.status === 'waiting') {
      // Already marked as paid — offer to unmark (sets back to 'requested' in DB → 'pending' in UI)
      Alert.alert(
        'Unmark as Paid?',
        'This will set your payment status back to unpaid. The host will need to re-verify your payment.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unmark',
            style: 'destructive',
            onPress: async () => {
              try {
                await updatePaidStatus(id ?? '', currentUserId, 'requested');
                setLocalStatusOverrides((prev) =>
                  new Map(prev).set(currentUserId, 'pending'),
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
    }
  };

  // All members with updated status, current user excluded from ordering/counts
  const allPeople = basePeople.map((p) => ({
    ...p,
    status: completedIds.has(p.id)
      ? ('completed' as PersonStatus)
      : localStatusOverrides.has(p.id)
        ? localStatusOverrides.get(p.id)!
        : p.status === 'completed'
          ? ('unrequested' as PersonStatus)
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

  // Counts / fractions exclude the current user and members who don't owe anything
  const relevantPeople = otherPeople.filter((p) => p.amount > 0);
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

  // You Are Owed: total value of items from receipts uploaded by me, minus what I claimed
  const myReceiptIds = new Set(
    receipts.filter((r) => r.created_by === currentUserId).map((r) => r.id),
  );
  // Per-person: how much each member has claimed from MY receipts specifically
  const myItemIds = new Set(
    items
      .filter((item) => myReceiptIds.has(item.receipt_id ?? ''))
      .map((i) => i.id),
  );
  const amountOwedToMePerPerson = new Map<string, number>(
    members.map((member) => {
      const owed = claims
        .filter(
          (c) => c.profile_id === member.profile_id && myItemIds.has(c.item_id),
        )
        .reduce((sum, c) => {
          const item = items.find((i) => i.id === c.item_id);
          return sum + (item ? item.unit_price * c.share : 0);
        }, 0);
      return [member.profile_id, owed];
    }),
  );
  const totalUploaded = items
    .filter((item) => myReceiptIds.has(item.receipt_id ?? ''))
    .reduce((sum, item) => sum + item.unit_price * item.amount, 0);
  const myClaimed = claims
    .filter((c) => c.profile_id === currentUserId)
    .reduce((sum, c) => {
      const item = items.find((i) => i.id === c.item_id);
      return sum + (item ? item.unit_price * c.share : 0);
    }, 0);
  const verifiedPaidAmount = [...completedIds].reduce(
    (sum, memberId) => sum + (amountOwedToMePerPerson.get(memberId) ?? 0),
    0,
  );
  const displayAmount = totalUploaded - myClaimed - verifiedPaidAmount;

  const statusParts: string[] = [];
  if (waitingCount > 0)
    statusParts.push(`${waitingCount} Awaiting Verification`);
  if (pendingCount > 0) statusParts.push(`${pendingCount} Requested & Unpaid`);
  if (unrequestedCount > 0)
    statusParts.push(`${unrequestedCount} Not Yet Requested`);

  // When user owes (didn't upload the receipt), progress bar reflects only self payment status
  const userOwes = displayAmount < 0;
  const selfStatusForBar = selfPerson?.status ?? 'unrequested';
  const barCompletedFraction = userOwes
    ? selfStatusForBar === 'completed'
      ? 1
      : 0
    : completedFraction;
  const barWaitingFraction = userOwes
    ? selfStatusForBar === 'waiting'
      ? 1
      : 0
    : waitingFraction;
  const barPendingFraction = userOwes
    ? selfStatusForBar === 'pending'
      ? 1
      : 0
    : pendingFraction;
  const barUnrequestedFraction = userOwes
    ? selfStatusForBar === 'unrequested'
      ? 1
      : 0
    : unrequestedFraction;
  const barCompletedCount = userOwes
    ? selfStatusForBar === 'completed'
      ? 1
      : 0
    : completedCount;
  const barTotal = userOwes ? 1 : total;
  const barStatusParts = userOwes
    ? selfStatusForBar === 'completed'
      ? []
      : selfStatusForBar === 'waiting'
        ? ['Awaiting Verification']
        : selfStatusForBar === 'pending'
          ? ['Payment Requested']
          : ['Not Yet Paid']
    : statusParts;

  const [roomName, setRoomName] = useState(name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSelfPayLoading, setIsSelfPayLoading] = useState(false);
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
                : 'All paid'}
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
              const selfRequested = isSelf && person.status === 'pending';
              const selfWaiting = isSelf && person.status === 'waiting';
              const selfUnrequested =
                isSelf && person.status === 'unrequested' && person.amount > 0;
              const owedToMeByPerson =
                amountOwedToMePerPerson.get(person.id) ?? 0;
              const borderColor = isSelf
                ? selfRequested
                  ? 'border-status-pending'
                  : selfWaiting
                    ? 'border-status-waiting'
                    : selfUnrequested
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
                ? selfRequested
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
                ? selfRequested
                  ? 'Payment Requested — tap to mark as paid'
                  : selfWaiting
                    ? 'Marked as Paid — Awaiting Verification'
                    : selfUnrequested
                      ? 'You owe money — tap to mark as paid'
                      : 'You'
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
                      if (
                        isSelf &&
                        (selfRequested || selfWaiting || selfUnrequested)
                      ) {
                        void handleSelfPayToggle();
                      } else if (!isSelf && owedToMeByPerson > 0) {
                        setSelectedPerson({
                          id: person.id,
                          name: person.name,
                          status: person.status,
                          amount: owedToMeByPerson,
                        });
                      }
                    }}
                  >
                    {/* Checkbox — interactive for self when payment is requested */}
                    <Pressable
                      onPress={() => {
                        if (selfRequested || selfWaiting || selfUnrequested) {
                          void handleSelfPayToggle();
                        } else if (!isSelf && owedToMeByPerson > 0) {
                          handleCheckboxPress(person);
                        }
                      }}
                      hitSlop={8}
                      disabled={
                        (isSelf &&
                          !selfRequested &&
                          !selfWaiting &&
                          !selfUnrequested) ||
                        (isSelf && isSelfPayLoading) ||
                        (!isSelf &&
                          (person.status === 'completed' ||
                            owedToMeByPerson <= 0))
                      }
                      className={`w-7 h-7 rounded-full border-2 items-center justify-center mr-3 ${borderColor}`}
                    >
                      {isSelf && isSelfPayLoading ? (
                        <ActivityIndicator size='small' />
                      ) : (
                        <>
                          {person.status === 'completed' && !isSelf && (
                            <MaterialCommunityIcons
                              name='check'
                              size={16}
                              className='text-status-completed'
                            />
                          )}
                          {selfWaiting && (
                            <MaterialCommunityIcons
                              name='check'
                              size={16}
                              className='text-status-waiting'
                            />
                          )}
                        </>
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

                    {/* Amount — shown for others who owe money, and for self when payment is requested/marked */}
                    {!isSelf && owedToMeByPerson > 0 && (
                      <Text className={`font-semibold mr-1 ${textColor}`}>
                        {completedIds.has(person.id)
                          ? '$0.00'
                          : `+$${person.amount.toFixed(2)}`}
                      </Text>
                    )}
                    {isSelf &&
                      (selfRequested || selfWaiting || selfUnrequested) &&
                      person.amount > 0 && (
                        <Text className={`font-semibold mr-1 ${textColor}`}>
                          ${person.amount.toFixed(2)}
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
                        handleRequestAction(selectedPerson, 'request')
                      }
                      disabled={!!actionLoading}
                    >
                      {actionLoading === 'request' ? (
                        <ActivityIndicator color='white' />
                      ) : (
                        <Text className='text-primary-foreground font-semibold text-base'>
                          {unclaimedItemCount > 0
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
                        onPress={() => void handleNudge(selectedPerson)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === 'nudge' ? (
                          <ActivityIndicator color='white' />
                        ) : (
                          <Text className='text-primary-foreground font-semibold text-base'>
                            Nudge
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
                          {selectedPerson.name} has logged a payment. If you
                          haven&apos;t received it, you can re-request.
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
                                  await persistVerify(selectedPerson.id, true);
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
                          handleRequestAction(selectedPerson, 'rerequst')
                        }
                        disabled={!!actionLoading}
                      >
                        {actionLoading === 'rerequst' ? (
                          <ActivityIndicator color='white' />
                        ) : (
                          <Text className='text-primary-foreground font-semibold text-base'>
                            Re-Request Payment
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
                                  void persistVerify(selectedPerson.id, false);
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
