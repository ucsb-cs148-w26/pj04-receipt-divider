import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers';
import { IconButton } from '@eezy-receipt/shared';
import { getUserGroups, PaidStatus } from '@/services/groupApi';

type HistoryItem = {
  id: string;
  name: string;
  status: 'completed' | 'pending';
  amount: number;
  members: number;
};

function mapPaidStatus(ps: PaidStatus): 'completed' | 'pending' {
  return ps === 'verified' ? 'completed' : 'pending';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'groups' | 'people'>('groups');
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [groups, setGroups] = useState<HistoryItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const metaName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email;

  const [profileName, setProfileName] = useState<string>(metaName ?? '');
  useEffect(() => {
    if (metaName) {
      setProfileName(metaName);
      return;
    }
    const timeout = setTimeout(() => {
      setProfileName('there');
    }, 300);
    return () => clearTimeout(timeout);
  }, [metaName]);

  const fetchGroups = useCallback(() => {
    setIsLoadingGroups(true);
    getUserGroups()
      .then(({ groups: fetched }) => {
        setGroups(
          fetched.map((g) => ({
            id: g.groupId,
            name: g.name ?? 'Unnamed Group',
            status: mapPaidStatus(g.paidStatus),
            amount: -g.totalClaimed,
            members: g.memberCount,
          })),
        );
      })
      .catch(console.error)
      .finally(() => setIsLoadingGroups(false));
  }, []);

  useFocusEffect(fetchGroups);

  const firstName = profileName.split(' ')[0] || 'there';

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    'U';

  const data: HistoryItem[] = activeTab === 'groups' ? groups : [];

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
        <Text
          className='flex-1 text-foreground text-2xl font-bold'
          numberOfLines={1}
        >
          Hi, {firstName}!
        </Text>
        <IconButton
          icon='cog-outline'
          iconClassName='text-accent-dark'
          onPress={() => router.navigate('/setting')}
        />
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
        {isLoadingGroups && activeTab === 'groups' ? (
          <View className='bg-card rounded-2xl p-8 items-center'>
            <ActivityIndicator />
          </View>
        ) : data.length === 0 ? (
          <View className='bg-card rounded-2xl p-8 items-center'>
            <Text className='text-muted-foreground text-sm'>
              {activeTab === 'groups' ? 'No groups yet' : 'No people yet'}
            </Text>
          </View>
        ) : (
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
                  <View pointerEvents='none'>
                    <IconButton
                      icon='chevron-right'
                      bgClassName='bg-transparent shadow-none'
                      iconClassName='text-accent-dark'
                    />
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <View className='absolute bottom-10 right-6'>
        <IconButton
          icon='plus'
          bgClassName='shadow-lg shadow-black/30'
          iconClassName='text-accent-dark'
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
                  <IconButton
                    icon='close'
                    bgClassName='bg-transparent shadow-none'
                    iconClassName='text-accent-dark'
                    onPress={() => setShowNewRoom(false)}
                  />
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
                  <View pointerEvents='none'>
                    <IconButton
                      icon='home-plus-outline'
                      bgClassName='bg-transparent shadow-none'
                      iconClassName='text-accent-dark'
                    />
                  </View>
                  <Text className='text-foreground text-base'>Create Room</Text>
                </Pressable>

                <View className='h-px bg-border mx-4' />

                {/* Join Room */}
                <Pressable
                  className='flex-row items-center gap-3 px-4 py-4 active:opacity-70'
                  onPress={() => {
                    setShowNewRoom(false);
                    router.navigate('/join-room' as never);
                  }}
                >
                  <View pointerEvents='none'>
                    <IconButton
                      icon='login'
                      bgClassName='bg-transparent shadow-none'
                      iconClassName='text-accent-dark'
                    />
                  </View>
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
