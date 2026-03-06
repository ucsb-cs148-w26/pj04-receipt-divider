import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ReceiptDetailParams = {
  id: string;
  name: string;
  amount: string;
};

type PersonStatus = 'pending' | 'waiting' | 'completed';

interface Person {
  id: string;
  name: string;
  status: PersonStatus;
  amount: number;
}

const MOCK_PEOPLE_BY_RECEIPT: Record<string, Person[]> = {
  '1': [
    { id: 'p1', name: 'Warden Creations', status: 'pending', amount: 27.1 },
    { id: 'p2', name: 'Warden Creations', status: 'waiting', amount: 27.1 },
    { id: 'p3', name: 'Warden Creations', status: 'completed', amount: 27.1 },
    { id: 'p4', name: 'Warden Creations', status: 'waiting', amount: 27.1 },
    { id: 'p5', name: 'Warden Creations', status: 'waiting', amount: 27.1 },
  ],
  '2': [
    { id: 'p1', name: 'Alice', status: 'pending', amount: 12.56 },
    { id: 'p2', name: 'Bob', status: 'completed', amount: 12.56 },
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
  const { id, name, amount } = params;
  const amountNum = parseFloat(amount ?? '0');
  const basePeople = MOCK_PEOPLE_BY_RECEIPT[id ?? ''] ?? [];
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(basePeople.filter((p) => p.status === 'completed').map((p) => p.id)),
  );

  const toggleCompleted = (personId: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const STATUS_ORDER: Record<PersonStatus, number> = { pending: 0, waiting: 1, completed: 2 };

  const people = basePeople
    .map((p) => ({
      ...p,
      status: completedIds.has(p.id) ? ('completed' as PersonStatus) : p.status === 'completed' ? ('pending' as PersonStatus) : p.status,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const completedCount = people.filter((p) => p.status === 'completed').length;
  const waitingCount = people.filter((p) => p.status === 'waiting').length;
  const pendingCount = people.filter((p) => p.status === 'pending').length;
  const total = people.length;

  const completedFraction = total > 0 ? completedCount / total : 0;
  const waitingFraction = total > 0 ? waitingCount / total : 0;

  const statusParts: string[] = [];
  if (pendingCount > 0)
    statusParts.push(`${pendingCount} pending`);
  if (waitingCount > 0)
    statusParts.push(`${waitingCount} waiting`);

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header */}
      <View className='flex-row items-center px-4 pt-2 pb-3'>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className='w-9 h-9 items-center justify-center rounded-full bg-card mr-2'
        >
          <MaterialCommunityIcons
            name='chevron-left'
            size={24}
            color='var(--color-accent-dark)'
          />
        </Pressable>
        <Text className='flex-1 text-center text-foreground text-xl font-bold'>
          {name}
        </Text>
        <Pressable hitSlop={8} className='w-9 h-9 items-center justify-center'>
          <MaterialCommunityIcons
            name='dots-horizontal'
            size={24}
            color='var(--color-accent-dark)'
          />
        </Pressable>
      </View>

      <ScrollView
        className='flex-1 px-4'
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
            ${Math.abs(amountNum).toFixed(2)}
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
                className='h-full bg-success'
                style={{ flex: completedFraction }}
              />
            )}
            {waitingFraction > 0 && (
              <View
                className='h-full bg-warning'
                style={{ flex: waitingFraction }}
              />
            )}
            <View
              className='h-full bg-border'
              style={{ flex: 1 - completedFraction - waitingFraction }}
            />
          </View>
        </View>

        {/* People section */}
        <Text className='text-foreground text-lg font-semibold mb-2 px-1'>
          People
        </Text>
        <View className='bg-card rounded-2xl overflow-hidden'>
          {people.map((person, index) => (
            <View key={person.id}>
              {index > 0 && <View className='h-px bg-border mx-4' />}
              <Pressable className='flex-row items-center px-4 py-3 active:opacity-70'>
                {/* Checkbox */}
                <Pressable
                  onPress={() => toggleCompleted(person.id)}
                  hitSlop={8}
                  className={`w-7 h-7 rounded-full border-2 items-center justify-center mr-3 ${
                    person.status === 'completed'
                      ? 'border-primary bg-transparent'
                      : 'border-border'
                  }`}
                >
                  {person.status === 'completed' && (
                    <MaterialCommunityIcons
                      name='check'
                      size={16}
                      color='var(--color-primary)'
                    />
                  )}
                </Pressable>

                {/* Name + status */}
                <View className='flex-1 mr-3'>
                  <Text
                    className={`font-semibold text-base ${
                      person.status === 'completed'
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground'
                    }`}
                    numberOfLines={1}
                  >
                    {person.name}
                  </Text>
                  <Text className='text-muted-foreground text-sm'>
                    · {person.status}
                  </Text>
                </View>

                {/* Amount */}
                <Text
                  className={`font-semibold mr-1 ${
                    person.status === 'completed'
                      ? 'text-muted-foreground line-through'
                      : 'text-amount-positive'
                  }`}
                >
                  +${person.amount.toFixed(2)}
                </Text>

                <MaterialCommunityIcons
                  name='chevron-right'
                  size={18}
                  color='var(--color-accent-dark)'
                />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
