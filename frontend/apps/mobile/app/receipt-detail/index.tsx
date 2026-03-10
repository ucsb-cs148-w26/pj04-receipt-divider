import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
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

  const handleCheckboxPress = (person: {
    id: string;
    name: string;
    status: PersonStatus;
  }) => {
    if (person.status === 'completed') {
      Alert.alert(
        'Already Verified',
        `${person.name} has been marked as paid & verified. Do you want to undo this?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unverify',
            style: 'destructive',
            onPress: () =>
              setCompletedIds((prev) => {
                const next = new Set(prev);
                next.delete(person.id);
                return next;
              }),
          },
        ],
      );
      return;
    }
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
          onPress: () =>
            setCompletedIds((prev) => new Set(prev).add(person.id)),
        },
      ]);
      return;
    }
    // status === 'waiting' — eligible to verify
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(person.id)) {
        next.delete(person.id);
      } else {
        next.add(person.id);
      }
      return next;
    });
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
    setSelectedPerson(null);
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
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const selfPerson = allPeople.find((p) => p.id === currentUserId);

  // people shown in list: others first (sorted), self pinned to bottom
  const people = selfPerson ? [...otherPeople, selfPerson] : otherPeople;

  // Counts / fractions exclude the current user
  const completedCount = otherPeople.filter(
    (p) => p.status === 'completed',
  ).length;
  const waitingCount = otherPeople.filter((p) => p.status === 'waiting').length;
  const pendingCount = otherPeople.filter((p) => p.status === 'pending').length;
  const unrequestedCount = otherPeople.filter(
    (p) => p.status === 'unrequested',
  ).length;
  const total = otherPeople.length;

  const completedFraction = total > 0 ? completedCount / total : 0;
  const waitingFraction = total > 0 ? waitingCount / total : 0;
  const pendingFraction = total > 0 ? pendingCount / total : 0;
  const unrequestedFraction = total > 0 ? unrequestedCount / total : 0;

  // You Are Owed: total value of items from receipts uploaded by me, minus what I claimed
  const myReceiptIds = new Set(
    receipts.filter((r) => r.created_by === currentUserId).map((r) => r.id),
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
  const displayAmount = totalUploaded - myClaimed;

  const statusParts: string[] = [];
  if (waitingCount > 0)
    statusParts.push(`${waitingCount} Awaiting Verification`);
  if (pendingCount > 0) statusParts.push(`${pendingCount} Requested & Unpaid`);
  if (unrequestedCount > 0)
    statusParts.push(`${unrequestedCount} Not Yet Requested`);

  const [roomName, setRoomName] = useState(name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          {editingName ? (
            <TextInput
              value={roomName}
              onChangeText={setRoomName}
              autoFocus
              returnKeyType='done'
              onSubmitEditing={() => {
                setEditingName(false);
                if (id && roomName.trim())
                  updateGroupName(id, roomName.trim()).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Save Failed',
                      'Could not save the group name. Please try again.',
                    );
                  });
              }}
              onBlur={() => {
                setEditingName(false);
                if (id && roomName.trim())
                  updateGroupName(id, roomName.trim()).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Save Failed',
                      'Could not save the group name. Please try again.',
                    );
                  });
              }}
              className='text-foreground text-xl font-bold text-center border-b border-border flex-1'
            />
          ) : (
            <Pressable
              onPress={() => setEditingName(true)}
              className='flex-row items-center gap-2'
              accessibilityLabel='Edit room name'
            >
              <Text
                className='text-foreground text-xl font-bold'
                numberOfLines={1}
              >
                {roomName}
              </Text>
              <MaterialCommunityIcons
                name='pencil-outline'
                size={18}
                className='text-muted-foreground'
              />
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
              {statusParts.length > 0 ? statusParts.join(', ') : 'All paid'}
            </Text>
            <Text className='text-muted-foreground text-sm'>
              {completedCount}/{total}
            </Text>
          </View>

          {/* Progress bar */}
          <View className='h-2.5 bg-border rounded-full overflow-hidden flex-row'>
            {completedFraction > 0 && (
              <View
                className='h-full bg-status-completed'
                style={{ flex: completedFraction }}
              />
            )}
            {waitingFraction > 0 && (
              <View
                className='h-full bg-status-waiting'
                style={{ flex: waitingFraction }}
              />
            )}
            {pendingFraction > 0 && (
              <View
                className='h-full bg-status-pending'
                style={{ flex: pendingFraction }}
              />
            )}
            {unrequestedFraction > 0 && (
              <View
                className='h-full bg-status-unrequested'
                style={{ flex: unrequestedFraction }}
              />
            )}
            {completedFraction +
              waitingFraction +
              pendingFraction +
              unrequestedFraction <
              1 && (
              <View
                className='h-full bg-border'
                style={{
                  flex:
                    1 -
                    completedFraction -
                    waitingFraction -
                    pendingFraction -
                    unrequestedFraction,
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
              const borderColor = isSelf
                ? 'border-border'
                : person.status === 'completed'
                  ? 'border-status-completed'
                  : person.status === 'waiting'
                    ? 'border-status-waiting'
                    : person.status === 'pending'
                      ? 'border-status-pending'
                      : 'border-status-unrequested';
              const textColor = isSelf
                ? 'text-muted-foreground'
                : person.status === 'completed'
                  ? 'text-muted-foreground line-through'
                  : person.status === 'waiting'
                    ? 'text-status-waiting'
                    : person.status === 'pending'
                      ? 'text-status-pending'
                      : 'text-status-unrequested';
              const statusLabel = isSelf
                ? 'You'
                : person.status === 'completed'
                  ? 'Paid & Verified'
                  : person.status === 'waiting'
                    ? 'Claimed, Awaiting Verification'
                    : person.status === 'pending'
                      ? 'Requested, Awaiting Payment'
                      : 'Not Yet Requested';
              return (
                <View key={person.id}>
                  {index > 0 && <View className='h-px bg-border mx-4' />}
                  <Pressable
                    className='flex-row items-center px-4 py-3 active:opacity-70'
                    onPress={() =>
                      !isSelf &&
                      setSelectedPerson({
                        id: person.id,
                        name: person.name,
                        status: person.status,
                        amount: person.amount,
                      })
                    }
                  >
                    {/* Checkbox — disabled for self */}
                    <Pressable
                      onPress={() => !isSelf && handleCheckboxPress(person)}
                      hitSlop={8}
                      disabled={isSelf}
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
                      <Text className='text-muted-foreground text-sm'>
                        {statusLabel}
                      </Text>
                    </View>

                    {/* Amount */}
                    {!isSelf && (
                      <Text className={`font-semibold mr-1 ${textColor}`}>
                        +${person.amount.toFixed(2)}
                      </Text>
                    )}

                    <MaterialCommunityIcons
                      name='chevron-right'
                      size={18}
                      className='text-accent-dark'
                    />
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
          onPress={() =>
            router.push({
              pathname: '/receipt-room',
              params: { roomId: id, items: '[]', participants: '[]' },
            })
          }
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
                        .then(() => router.replace('/'))
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
                      className='bg-primary rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                      onPress={() =>
                        handleRequestAction(selectedPerson, 'request')
                      }
                    >
                      <Text className='text-primary-foreground font-semibold text-base'>
                        Request Money
                      </Text>
                    </Pressable>
                  )}

                  {selectedPerson.status === 'pending' && (
                    <Pressable
                      className='bg-destructive rounded-2xl py-3.5 items-center active:opacity-80 mb-3'
                      onPress={() =>
                        handleRequestAction(selectedPerson, 'cancel')
                      }
                    >
                      <Text className='text-destructive-foreground font-semibold text-base'>
                        Cancel Request
                      </Text>
                    </Pressable>
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
                        onPress={() =>
                          handleRequestAction(selectedPerson, 'rerequst')
                        }
                      >
                        <Text className='text-primary-foreground font-semibold text-base'>
                          Re-Request Payment
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {selectedPerson.status === 'completed' && (
                    <View className='bg-status-completed/10 border border-status-completed rounded-xl px-4 py-3 mb-3'>
                      <Text className='text-status-completed text-sm text-center font-semibold'>
                        Payment Verified ✓
                      </Text>
                    </View>
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
