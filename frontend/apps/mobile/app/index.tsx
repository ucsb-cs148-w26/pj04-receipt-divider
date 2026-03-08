import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers';
import { IconButton } from '@eezy-receipt/shared';

const MOCK_GROUPS = [
  { id: '1', name: 'Costco', status: 'pending', amount: 135.12, members: 5 },
  { id: '2', name: 'Chipotle', status: 'pending', amount: -25.12, members: 2 },
  { id: '3', name: 'Target', status: 'pending', amount: 75.21, members: 5 },
  { id: '4', name: 'Taco Bell', status: 'completed', amount: 5.99, members: 2 },
  {
    id: '5',
    name: "Trader Joe's",
    status: 'completed',
    amount: 7.02,
    members: 4,
  },
  {
    id: '6',
    name: "Trader Joe's",
    status: 'completed',
    amount: 7.02,
    members: 4,
  },
];

const MOCK_PEOPLE = [
  { id: '1', name: 'Alice', status: 'pending', amount: -20.0, members: 1 },
  { id: '2', name: 'Bob', status: 'completed', amount: 45.0, members: 1 },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'groups' | 'people'>('groups');
  const [showNewRoom, setShowNewRoom] = useState(false);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    'U';

  const data = activeTab === 'groups' ? MOCK_GROUPS : MOCK_PEOPLE;

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header */}
      <View className='flex-row items-center px-5 pt-2 pb-3'>
        <View className='w-10 h-10 rounded-full overflow-hidden mr-3'>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className='w-full h-full' />
          ) : (
            <View className='w-full h-full items-center justify-center bg-primary'>
              <Text className='text-white font-bold text-base'>
                {displayName[0]?.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text className='flex-1 text-foreground text-2xl font-bold'>
          Eezy Receipt
        </Text>
        <Pressable onPress={() => router.navigate('/setting')} hitSlop={8}>
          <MaterialCommunityIcons
            name='menu'
            size={28}
            color='var(--color-accent-dark)'
          />
        </Pressable>
      </View>

      <ScrollView
        className='flex-1 px-5'
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Finances */}
        <Text className='text-foreground text-2xl font-bold mb-3'>
          Finances
        </Text>
        <View className='flex-row gap-3 mb-6'>
          <View className='flex-1 bg-card rounded-2xl p-4'>
            <Text className='text-muted-foreground text-sm mb-1'>You Owe</Text>
            <Text className='text-amount-negative text-2xl font-bold'>
              $64.91
            </Text>
          </View>
          <View className='flex-1 bg-card rounded-2xl p-4'>
            <Text className='text-muted-foreground text-sm mb-1'>
              You Are Owed
            </Text>
            <Text className='text-amount-positive text-2xl font-bold'>
              $105.62
            </Text>
          </View>
        </View>

        {/* History header + toggle */}
        <View className='flex-row items-center justify-between mb-3'>
          <Text className='text-foreground text-2xl font-bold'>History</Text>
          <View className='flex-row border border-border rounded-full overflow-hidden'>
            <Pressable
              onPress={() => setActiveTab('groups')}
              className={`px-4 py-1.5 ${activeTab === 'groups' ? 'bg-card' : ''}`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === 'groups'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                Groups
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('people')}
              className={`px-4 py-1.5 ${activeTab === 'people' ? 'bg-card' : ''}`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === 'people'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                People
              </Text>
            </Pressable>
          </View>
        </View>

        {/* History list */}
        <View className='bg-card rounded-2xl overflow-hidden'>
          {data.map((item, index) => (
            <View key={item.id}>
              {index > 0 && <View className='h-px bg-border mx-4' />}
              <Pressable
                className='flex-row items-center px-4 py-3 active:opacity-70'
                onPress={() =>
                  router.navigate({
                    pathname: '/receipt-detail',
                    params: {
                      id: item.id,
                      name: item.name,
                      amount: item.amount.toString(),
                      tab: activeTab,
                    },
                  })
                }
              >
                <View className='flex-1 mr-3'>
                  <Text
                    className={`font-bold text-base ${item.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className='text-muted-foreground text-sm'>
                    {activeTab === 'groups'
                      ? `${item.members} ${item.members === 1 ? 'member' : 'members'} · ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`
                      : item.status.charAt(0).toUpperCase() +
                        item.status.slice(1)}
                  </Text>
                </View>
                <Text
                  className={`font-semibold mr-1 ${
                    item.status === 'completed'
                      ? 'text-muted-foreground line-through'
                      : item.amount >= 0
                        ? 'text-amount-positive'
                        : 'text-amount-negative'
                  }`}
                >
                  {item.amount >= 0 ? '+' : ''}$
                  {Math.abs(item.amount).toFixed(2)}
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

      {/* FAB */}
      <View className='absolute bottom-10 right-6'>
        <IconButton
          icon='plus'
          bgClassName='bg-card shadow-lg shadow-black/30'
          pressEffect='scale'
          onPress={() => setShowNewRoom(true)}
        />
      </View>

      {/* New Room popup */}
      <Modal
        transparent
        animationType='fade'
        visible={showNewRoom}
        onRequestClose={() => setShowNewRoom(false)}
      >
        <Pressable
          className='flex-1 bg-black/30'
          onPress={() => setShowNewRoom(false)}
        >
          <View className='flex-1 justify-end pb-28 pr-6 items-end'>
            <Pressable onPress={() => {}}>
              <View className='bg-card rounded-2xl shadow-xl shadow-black/40 w-52 overflow-hidden'>
                {/* Header */}
                <View className='flex-row items-center justify-between px-4 pt-4 pb-3'>
                  <Text className='text-foreground text-lg font-bold'>
                    New Room
                  </Text>
                  <Pressable onPress={() => setShowNewRoom(false)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name='close'
                      size={20}
                      color='var(--color-accent-dark)'
                    />
                  </Pressable>
                </View>

                <View className='h-px bg-border' />

                {/* Create Room */}
                <Pressable
                  className='flex-row items-center gap-3 px-4 py-4 active:opacity-70'
                  onPress={() => {
                    setShowNewRoom(false);
                    router.navigate('/create-room');
                  }}
                >
                  <MaterialCommunityIcons
                    name='checkbox-outline'
                    size={22}
                    color='var(--color-accent-dark)'
                  />
                  <Text className='text-foreground text-base'>Create Room</Text>
                </Pressable>

                <View className='h-px bg-border mx-4' />

                {/* Join Room */}
                <Pressable
                  className='flex-row items-center gap-3 px-4 py-4 active:opacity-70'
                  onPress={() => {
                    setShowNewRoom(false);
                    router.navigate('/qr');
                  }}
                >
                  <MaterialCommunityIcons
                    name='export-variant'
                    size={22}
                    color='var(--color-accent-dark)'
                  />
                  <Text className='text-foreground text-base'>Join Room</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
