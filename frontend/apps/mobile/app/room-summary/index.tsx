import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { IconButton } from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGroupData } from '@/hooks';
import { useAuth } from '@/providers';
import { updateDebtStatus, finishGroup } from '@/services/groupApi';
import { supabase } from '@/services/supabase';
import type {
  GroupMember as DbGroupMember,
  ItemClaim as DbItemClaim,
  Item as DbItem,
} from '@eezy-receipt/shared';
import { splitAmountByRank } from '@eezy-receipt/shared';

type RoomSummaryParams = { roomId: string };

interface PersonSummary {
  profileId: string;
  name: string;
  accentColor: string;
  items: { name: string; price: string }[];
  subtotal: number;
  tax: number;
}

const MAX_ITEMS_SHOWN = 5;

export default function RoomSummaryScreen() {
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<RoomSummaryParams>();
  const groupData = useGroupData(roomId ?? '');
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const [groupName, setGroupName] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    supabase
      .from('groups')
      .select('name')
      .eq('id', roomId)
      .single()
      .then(({ data }) => setGroupName(data?.name ?? 'Room'));
  }, [roomId]);

  /** Compute per-person item summaries from raw DB data */
  const summaries = useMemo((): PersonSummary[] => {
    if (!groupData.isLoaded) return [];
    const members = groupData.members as DbGroupMember[];
    const claims = groupData.claims as DbItemClaim[];
    const items = groupData.items as DbItem[];

    // taxPerItem: itemId → this item's share of its receipt's tax (tax / itemsInReceipt)
    const receiptItemCount = new Map<string, number>();
    for (const item of items) {
      if (item.receipt_id) {
        receiptItemCount.set(
          item.receipt_id,
          (receiptItemCount.get(item.receipt_id) ?? 0) + 1,
        );
      }
    }
    const taxPerItem = new Map<string, number>(); // itemId → tax/itemCount
    for (const item of items) {
      if (!item.receipt_id) continue;
      const receipt = groupData.receipts.find((r) => r.id === item.receipt_id);
      if (!receipt || receipt.tax == null || receipt.tax <= 0) continue;
      const count = receiptItemCount.get(item.receipt_id) ?? 1;
      taxPerItem.set(item.id, receipt.tax / count);
    }
    // claimants per item (profile IDs)
    const claimantsPerItem = new Map<string, string[]>();
    for (const c of claims) {
      const list = claimantsPerItem.get(c.item_id) ?? [];
      list.push(c.profile_id);
      claimantsPerItem.set(c.item_id, list);
    }

    // Member join order for rank computation
    const memberJoinOrder = members.map((m) => m.profile_id);

    return members.map((member) => {
      const memberClaims = claims.filter(
        (c) => c.profile_id === member.profile_id,
      );
      const memberItems = memberClaims
        .map((claim) => {
          const item = items.find((i) => i.id === claim.item_id);
          if (!item) return null;
          const fullPrice = item.unit_price * (item.amount ?? 1);
          const claimants = claimantsPerItem.get(claim.item_id) ?? [
            member.profile_id,
          ];
          const sorted = [...claimants].sort(
            (a, b) => memberJoinOrder.indexOf(a) - memberJoinOrder.indexOf(b),
          );
          const rank = sorted.indexOf(member.profile_id) + 1;
          const share = splitAmountByRank(fullPrice, claimants.length, rank);
          return { name: item.name ?? 'Item', price: share.toFixed(2) };
        })
        .filter((i): i is { name: string; price: string } => i !== null);
      const subtotal = memberItems.reduce((s, i) => s + parseFloat(i.price), 0);
      const tax = memberClaims.reduce((s, claim) => {
        const perItem = taxPerItem.get(claim.item_id);
        if (perItem == null) return s;
        const claimants = claimantsPerItem.get(claim.item_id) ?? [
          member.profile_id,
        ];
        const sorted = [...claimants].sort(
          (a, b) => memberJoinOrder.indexOf(a) - memberJoinOrder.indexOf(b),
        );
        const rank = sorted.indexOf(member.profile_id) + 1;
        return s + splitAmountByRank(perItem, claimants.length, rank);
      }, 0);
      return {
        profileId: member.profile_id,
        name: groupData.profiles[member.profile_id]?.username ?? 'Member',
        accentColor:
          groupData.profiles[member.profile_id]?.accentColor ?? '#888888',
        items: memberItems,
        subtotal,
        tax: Math.round(tax * 100) / 100,
      };
    });
  }, [
    groupData.isLoaded,
    groupData.members,
    groupData.claims,
    groupData.items,
    groupData.profiles,
    groupData.receipts,
  ]);

  const handleConfirm = async () => {
    if (!roomId) return;
    setIsSending(true);
    try {
      // Only request payment from members who actually owe money, excluding the host themselves
      const owingSummaries = summaries.filter(
        (s) => s.subtotal + s.tax > 0 && s.profileId !== currentUserId,
      );

      // 1. Detect guest profiles (empty email = anonymous/guest user)
      const profileIds = owingSummaries.map((s) => s.profileId);
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', profileIds);
      const guestIds = new Set(
        (profileRows ?? [])
          .filter((p) => !p.email || p.email === '')
          .map((p) => p.id as string),
      );

      // 2. If there are guest participants who owe money, inform the host
      const owingGuests = owingSummaries.filter((s) =>
        guestIds.has(s.profileId),
      );
      if (owingGuests.length > 0) {
        await new Promise<void>((resolve) => {
          const guestNames = owingGuests.map((s) => s.name).join(', ');
          Alert.alert(
            'Guests in Room',
            `Payment requests aren't available for guests (${guestNames}). To collect payment, go to the receipt detail room and tap on each guest to send them an SMS with their total.`,
            [{ text: 'OK', onPress: () => resolve() }],
          );
        });
      }

      // 3. Mark only non-guest owing members as 'requested' and finish the group
      const nonGuestOwing = owingSummaries.filter(
        (s) => !guestIds.has(s.profileId),
      );
      await Promise.all(
        nonGuestOwing.map((s) =>
          updateDebtStatus(roomId, s.profileId, currentUserId, 'requested'),
        ),
      );
      await finishGroup(roomId);

      Alert.alert(
        'Room Completed!',
        'Money requests have been sent. The room is now complete — only you can make further changes. All participants have been notified.',
        [{ text: 'OK', onPress: () => router.dismissAll() }],
      );
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setIsSending(false);
    }
  };

  if (!groupData.isLoaded) {
    return (
      <SafeAreaView className='bg-background flex-1 items-center justify-center'>
        <ActivityIndicator size='large' color='#4999DF' />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className='bg-background flex-1'>
      {/* Header */}
      <View
        className='flex-row items-center px-4 pb-3 gap-3'
        style={{ paddingTop: insets.top > 0 ? 8 : 16 }}
      >
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
        <View className='flex-1'>
          <Text className='text-foreground text-lg font-bold' numberOfLines={1}>
            {groupName || 'Room Summary'}
          </Text>
          <Text className='text-muted-foreground text-xs'>
            Review everyone&apos;s items before sending requests
          </Text>
        </View>
      </View>

      {/* Person cards grid */}
      <ScrollView
        className='flex-1 px-3'
        contentContainerClassName='pb-6'
        showsVerticalScrollIndicator={false}
      >
        {summaries.length === 0 ? (
          <View className='items-center justify-center py-16'>
            <Text className='text-muted-foreground text-base'>
              No participants found.
            </Text>
          </View>
        ) : (
          <View className='flex-row flex-wrap gap-3'>
            {summaries.map((person) => (
              <PersonCard key={person.profileId} person={person} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View className='px-4 pb-4 pt-2 border-t border-border bg-background'>
        <Pressable
          className='bg-primary rounded-2xl py-4 items-center justify-center active:opacity-70'
          onPress={handleConfirm}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator color='#ffffff' />
          ) : (
            <Text className='text-primary-foreground font-bold text-base'>
              Confirm & Request Money
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function PersonCard({ person }: { person: PersonSummary }) {
  const shownItems = person.items.slice(0, MAX_ITEMS_SHOWN);
  const extraCount = person.items.length - shownItems.length;

  return (
    <View
      className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10'
      style={{ width: '47%' }}
    >
      {/* Colored top bar */}
      <View style={{ height: 10, backgroundColor: person.accentColor }} />

      <View className='p-3 gap-1'>
        {/* Name */}
        <Text
          className='text-foreground font-bold text-sm mb-1'
          numberOfLines={1}
        >
          {person.name}
        </Text>

        {/* Items */}
        {shownItems.length === 0 ? (
          <Text className='text-muted-foreground text-xs italic'>No items</Text>
        ) : (
          shownItems.map((item, idx) => (
            <View key={idx} className='flex-row justify-between gap-1'>
              <Text
                className='text-foreground text-xs flex-1'
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text className='text-muted-foreground text-xs'>
                ${item.price}
              </Text>
            </View>
          ))
        )}

        {extraCount > 0 && (
          <View className='flex-row items-center gap-1 mt-0.5'>
            <MaterialCommunityIcons
              name='dots-horizontal'
              size={14}
              color='#888'
            />
            <Text className='text-muted-foreground text-xs'>
              {extraCount} more {extraCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
        )}

        {/* Divider + totals */}
        <View className='h-px bg-border mt-2 mb-1' />
        {person.tax > 0 && (
          <>
            <View className='flex-row justify-between'>
              <Text className='text-muted-foreground text-xs'>Subtotal</Text>
              <Text className='text-muted-foreground text-xs'>
                ${person.subtotal.toFixed(2)}
              </Text>
            </View>
            <View className='flex-row justify-between'>
              <Text className='text-muted-foreground text-xs'>Tax</Text>
              <Text className='text-muted-foreground text-xs'>
                ${person.tax.toFixed(2)}
              </Text>
            </View>
          </>
        )}
        <View className='flex-row justify-between mt-0.5'>
          <Text className='text-muted-foreground text-xs font-medium'>
            {person.tax > 0 ? 'Total' : 'Subtotal'}
          </Text>
          <Text className='text-foreground text-xs font-bold'>
            ${(person.subtotal + person.tax).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}
