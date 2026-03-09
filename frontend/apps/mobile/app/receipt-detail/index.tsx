import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton } from '@eezy-receipt/shared';

export type ReceiptDetailParams = {
  id: string;
  name: string;
  amount: string;
  tab?: 'groups' | 'people';
};

type PersonStatus = 'pending' | 'waiting' | 'completed';

interface Person {
  id: string;
  name: string;
  status: PersonStatus;
  amount: number;
  group?: string;
}

const MOCK_PEOPLE_BY_RECEIPT: Record<string, Person[]> = {
  '1': [
    {
      id: 'p1',
      name: 'Alice',
      status: 'pending',
      amount: 27.1,
      group: 'Costco',
    },
    {
      id: 'p2',
      name: 'Alice',
      status: 'waiting',
      amount: 25.12,
      group: 'Chipotle',
    },
    {
      id: 'p3',
      name: 'Alice',
      status: 'completed',
      amount: 15.04,
      group: 'Target',
    },
    {
      id: 'p4',
      name: 'Alice',
      status: 'waiting',
      amount: 5.99,
      group: 'Taco Bell',
    },
    {
      id: 'p5',
      name: 'Alice',
      status: 'pending',
      amount: 7.02,
      group: "Trader Joe's",
    },
  ],
  '2': [
    {
      id: 'p1',
      name: 'Bob',
      status: 'pending',
      amount: 12.56,
      group: 'Chipotle',
    },
    {
      id: 'p2',
      name: 'Bob',
      status: 'completed',
      amount: 12.56,
      group: 'Target',
    },
  ],
  '3': [
    { id: 'p1', name: 'Carol', status: 'completed', amount: 15.04 },
    { id: 'p2', name: 'Dave', status: 'waiting', amount: 15.04 },
    { id: 'p3', name: 'Eve', status: 'pending', amount: 15.04 },
    { id: 'p4', name: 'Frank', status: 'completed', amount: 15.04 },
    { id: 'p5', name: 'Grace', status: 'waiting', amount: 15.04 },
  ],
  '4': [
    { id: 'p1', name: 'Alice', status: 'completed', amount: 2.995 },
    { id: 'p2', name: 'Bob', status: 'completed', amount: 2.995 },
  ],
  '5': [
    { id: 'p1', name: 'Carol', status: 'completed', amount: 1.755 },
    { id: 'p2', name: 'Dave', status: 'completed', amount: 1.755 },
    { id: 'p3', name: 'Eve', status: 'completed', amount: 1.755 },
    { id: 'p4', name: 'Frank', status: 'completed', amount: 1.755 },
  ],
  '6': [
    { id: 'p1', name: 'Carol', status: 'completed', amount: 1.755 },
    { id: 'p2', name: 'Dave', status: 'completed', amount: 1.755 },
    { id: 'p3', name: 'Eve', status: 'completed', amount: 1.755 },
    { id: 'p4', name: 'Frank', status: 'completed', amount: 1.755 },
  ],
};

export default function ReceiptDetailScreen() {
  const params = useLocalSearchParams<ReceiptDetailParams>();
  const { id, name, amount, tab } = params;
  const amountNum = parseFloat(amount ?? '0');
  const basePeople = MOCK_PEOPLE_BY_RECEIPT[id ?? ''] ?? [];
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () =>
      new Set(
        basePeople.filter((p) => p.status === 'completed').map((p) => p.id),
      ),
  );

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
    if (person.status === 'pending') {
      Alert.alert(
        'Payment Not Yet Claimed',
        `${person.name} hasn't submitted their claim yet. Do you want to verify them anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify Anyway',
            style: 'destructive',
            onPress: () =>
              setCompletedIds((prev) => new Set(prev).add(person.id)),
          },
        ],
      );
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
    completed: 2,
  };

  const people = basePeople
    .map((p) => ({
      ...p,
      status: completedIds.has(p.id)
        ? ('completed' as PersonStatus)
        : p.status === 'completed'
          ? ('pending' as PersonStatus)
          : p.status,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const completedCount = people.filter((p) => p.status === 'completed').length;
  const waitingCount = people.filter((p) => p.status === 'waiting').length;
  const pendingCount = people.filter((p) => p.status === 'pending').length;
  const total = people.length;

  const completedFraction = total > 0 ? completedCount / total : 0;
  const waitingFraction = total > 0 ? waitingCount / total : 0;
  const pendingFraction = total > 0 ? pendingCount / total : 0;

  const remainingAmount = people
    .filter((p) => p.status !== 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  const displayAmount = amountNum >= 0 ? remainingAmount : -remainingAmount;

  const statusParts: string[] = [];
  if (waitingCount > 0)
    statusParts.push(`${waitingCount} Awaiting Verification`);
  if (pendingCount > 0) statusParts.push(`${pendingCount} Requested & Unpaid`);

  const [roomName, setRoomName] = useState(name ?? '');
  const [editingName, setEditingName] = useState(false);

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
              onSubmitEditing={() => setEditingName(false)}
              onBlur={() => setEditingName(false)}
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
      >
        {/* You Are Owed / You Owe card */}
        <View className='bg-card rounded-2xl p-5 mb-4'>
          <Text className='text-muted-foreground text-sm mb-1'>
            {amountNum >= 0 ? 'You Are Owed' : 'You Owe'}
          </Text>
          <Text
            className={`text-3xl font-bold mb-3 ${
              amountNum >= 0 ? 'text-amount-positive' : 'text-amount-negative'
            }`}
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
            {completedFraction + waitingFraction + pendingFraction < 1 && (
              <View
                className='h-full bg-border'
                style={{
                  flex:
                    1 - completedFraction - waitingFraction - pendingFraction,
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
          {people.map((person, index) => (
            <View key={person.id}>
              {index > 0 && <View className='h-px bg-border mx-4' />}
              <Pressable className='flex-row items-center px-4 py-3 active:opacity-70'>
                {/* Checkbox */}
                <Pressable
                  onPress={() => handleCheckboxPress(person)}
                  hitSlop={8}
                  className={`w-7 h-7 rounded-full border-2 items-center justify-center mr-3 ${
                    person.status === 'completed'
                      ? 'border-status-completed'
                      : person.status === 'waiting'
                        ? 'border-status-waiting'
                        : 'border-status-pending'
                  }`}
                >
                  {person.status === 'completed' && (
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
                    className={`font-semibold text-base ${
                      person.status === 'completed'
                        ? 'text-muted-foreground line-through'
                        : person.status === 'waiting'
                          ? 'text-status-waiting'
                          : 'text-status-pending'
                    }`}
                    numberOfLines={1}
                  >
                    {tab === 'people'
                      ? (person.group ?? person.name)
                      : person.name}
                  </Text>
                  <Text className='text-muted-foreground text-sm'>
                    {person.status === 'completed'
                      ? 'Paid & Verified'
                      : person.status === 'waiting'
                        ? 'Claimed, Awaiting Verification'
                        : 'Requested, Awaiting Payment'}
                  </Text>
                </View>

                {/* Amount */}
                <Text
                  className={`font-semibold mr-1 ${
                    person.status === 'completed'
                      ? 'text-muted-foreground line-through'
                      : person.status === 'waiting'
                        ? 'text-status-waiting'
                        : 'text-status-pending'
                  }`}
                >
                  +${person.amount.toFixed(2)}
                </Text>

                <MaterialCommunityIcons
                  name='chevron-right'
                  size={18}
                  className='text-accent-dark'
                />
              </Pressable>
            </View>
          ))}
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
      </ScrollView>
    </SafeAreaView>
  );
}
