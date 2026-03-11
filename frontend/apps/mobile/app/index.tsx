import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useGroupCache } from '@/providers';
import { supabase } from '@/services/supabase';
import { IconButton } from '@eezy-receipt/shared';
import type { GroupSummary } from '@/services/groupApi';

type RoomStatus = 'completed' | 'in-progress' | 'payment-pending';

const STATUS_LABELS: Record<RoomStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  'payment-pending': 'Payment Pending',
};

const STATUS_COLORS: Record<RoomStatus, string> = {
  completed: 'text-status-completed',
  'in-progress': 'text-muted-foreground',
  'payment-pending': 'text-status-pending',
};

function getRoomStatus(g: GroupSummary): RoomStatus {
  if (g.allMembersPaid) return 'completed';
  if (!g.isFinished) return 'in-progress';
  return 'payment-pending';
}

type HistoryItem = {
  id: string;
  name: string;
  status: RoomStatus;
  amount: number;
  members: number;
};

export default function HomeScreen() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { myGroups, refetchMyGroups, groupEntries } = useGroupCache();
  const [activeTab, setActiveTab] = useState<'groups' | 'people'>('groups');
  const [showNewRoom, setShowNewRoom] = useState(false);

  console.log(myGroups);

  const [profileName, setProfileName] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string | null>(null);

  const fetchProfile = useCallback(() => {
    if (!user?.id) return;
    void supabase
      .from('profiles')
      .select('username, accent_color')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.username) setProfileName(data.username);
        if (data?.accent_color) setAccentColor(data.accent_color);
      });
  }, [user?.id]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const PAYMENT_MODAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  // Local cache of the next-nudge timestamp so we don't re-show the modal on
  // every focus-triggered myGroups refresh within the cooldown window.
  const nextNudgeRef = useRef<number>(0);

  const fetchGroups = useCallback(() => {
    if (!user) return;
    void refetchMyGroups();
  }, [refetchMyGroups, user]);

  // When the persisted session loads after a cold start, trigger an initial fetch.
  useEffect(() => {
    if (user && !isAuthLoading) {
      void refetchMyGroups();
    }
  }, [user, isAuthLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchMyGroups(),
      new Promise<void>((res) => {
        fetchProfile();
        res();
      }),
    ]);
    setIsRefreshing(false);
  }, [refetchMyGroups, fetchProfile]);

  useFocusEffect(fetchGroups);
  useFocusEffect(fetchProfile);

  const groups: HistoryItem[] = (myGroups ?? [])
    .slice()
    .sort((a, b) => {
      const statusA = getRoomStatus(a);
      const statusB = getRoomStatus(b);
      if (statusA === 'completed' && statusB !== 'completed') return 1;
      if (statusA !== 'completed' && statusB === 'completed') return -1;
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map((g) => ({
      id: g.groupId,
      name: g.name ?? 'Unnamed Group',
      status: getRoomStatus(g),
      amount: g.totalUploaded - g.totalClaimed,
      members: g.memberCount,
    }));

  // Groups where the host has requested payment from the current user and they owe money
  const requestedGroups = (myGroups ?? []).filter(
    (g) =>
      g.paidStatus === 'requested' && g.totalUploaded - g.totalClaimed < -0.001,
  );

  // Show payment modal when next_nudge is due and there are pending payment requests
  useEffect(() => {
    if (myGroups === null || !user?.id) return;
    if (requestedGroups.length === 0) return;
    // If we already know we're within the cooldown window, skip the DB query.
    if (nextNudgeRef.current > Date.now()) return;
    void supabase
      .from('profiles')
      .select('next_nudge')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const now = Date.now();
        const nextNudge = data?.next_nudge
          ? new Date(data.next_nudge).getTime()
          : 0;
        nextNudgeRef.current = nextNudge;
        if (now >= nextNudge) {
          setShowPaymentModal(true);
        }
      });
  }, [myGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissPaymentModal = () => {
    if (!user?.id) return;
    const nextNudgeTs = new Date(
      Date.now() + PAYMENT_MODAL_INTERVAL_MS,
    ).toISOString();
    // Update local cache immediately so subsequent myGroups refreshes don't re-show the modal.
    nextNudgeRef.current = Date.now() + PAYMENT_MODAL_INTERVAL_MS;
    void supabase
      .from('profiles')
      .update({ next_nudge: nextNudgeTs })
      .eq('id', user.id);
    setShowPaymentModal(false);
  };

  const firstName = profileName.split(' ')[0] || 'there';

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    'U';

  const data: HistoryItem[] = activeTab === 'groups' ? groups : [];

  const youAreOwed = groups
    .filter((g) => g.amount > 0)
    .reduce((sum, g) => sum + g.amount, 0);
  const youOwe = groups
    .filter((g) => g.amount < 0)
    .reduce((sum, g) => sum + Math.abs(g.amount), 0);

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header */}
      <View className='flex-row items-center px-5 pt-2 pb-3'>
        <View className='w-10 h-10 rounded-full overflow-hidden mr-3'>
          <View
            className={`w-full h-full items-center justify-center${accentColor ? '' : ' bg-primary'}`}
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          >
            <Text className='text-white font-bold text-base'>
              {displayName[0]?.toUpperCase()}
            </Text>
          </View>
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
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Finances */}
        <Text className='text-foreground text-2xl font-bold mb-3'>
          Finances
        </Text>
        <View className='flex-row gap-3 mb-6'>
          <View className='flex-1 bg-card rounded-2xl p-4'>
            <Text className='text-muted-foreground text-sm mb-1'>You Owe</Text>
            <Text className='text-amount-negative text-2xl font-bold'>
              ${youOwe.toFixed(2)}
            </Text>
          </View>
          <View className='flex-1 bg-card rounded-2xl p-4'>
            <Text className='text-muted-foreground text-sm mb-1'>
              You Are Owed
            </Text>
            <Text className='text-amount-positive text-2xl font-bold'>
              ${youAreOwed.toFixed(2)}
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
        {myGroups === null && activeTab === 'groups' ? (
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
                        ? `${item.members} ${item.members === 1 ? 'member' : 'members'} · `
                        : ''}
                      <Text
                        className={`${groupEntries[item.id]?.createdBy === user?.id ? 'text-primary' : 'text-muted-foreground'} text-sm font-medium`}
                      >
                        {groupEntries[item.id]?.createdBy === user?.id
                          ? 'Host'
                          : 'Member'}
                      </Text>
                      {' · '}
                      <Text className={`${STATUS_COLORS[item.status]} text-sm`}>
                        {STATUS_LABELS[item.status]}
                      </Text>
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
                    {item.amount >= 0 ? '+' : '-'}$
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

      {/* Payment Request Alert Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={showPaymentModal}
        onRequestClose={dismissPaymentModal}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-center px-6'
          onPress={dismissPaymentModal}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-2xl overflow-hidden shadow-xl shadow-black/40'>
              {/* Header */}
              <View className='px-5 pt-5 pb-3'>
                <Text className='text-foreground text-xl font-bold mb-1'>
                  💳 Payment Requested
                </Text>
                <Text className='text-muted-foreground text-sm'>
                  The following rooms are requesting payment from you:
                </Text>
              </View>

              <View className='h-px bg-border mx-5' />

              {/* List of rooms */}
              {requestedGroups.map((g, index) => (
                <View key={g.groupId}>
                  {index > 0 && <View className='h-px bg-border mx-5' />}
                  <Pressable
                    className='flex-row items-center justify-between px-5 py-4 active:opacity-70'
                    onPress={() => {
                      dismissPaymentModal();
                      router.navigate({
                        pathname: '/receipt-detail',
                        params: {
                          id: g.groupId,
                          name: g.name ?? 'Unnamed Group',
                          amount: (g.totalUploaded - g.totalClaimed).toString(),
                        },
                      });
                    }}
                  >
                    <View className='flex-1 mr-3'>
                      <Text
                        className='text-foreground font-semibold text-base'
                        numberOfLines={1}
                      >
                        {g.name ?? 'Unnamed Group'}
                      </Text>
                      <Text className='text-status-pending text-sm'>
                        You owe $
                        {Math.abs(g.totalUploaded - g.totalClaimed).toFixed(2)}
                      </Text>
                    </View>
                    <Text className='text-primary font-medium text-sm'>
                      View →
                    </Text>
                  </Pressable>
                </View>
              ))}

              <View className='h-px bg-border mx-5' />

              {/* Dismiss */}
              <Pressable
                className='py-4 items-center active:opacity-70'
                onPress={dismissPaymentModal}
              >
                <Text className='text-muted-foreground text-base'>Dismiss</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
