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
import { IconButton, sendSMS } from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGroupData } from '@/hooks';
import { useAuth } from '@/providers';
import {
  updatePaidStatus,
  createInviteLink,
  finishGroup,
} from '@/services/groupApi';
import { supabase } from '@/services/supabase';
import type {
  GroupMember as DbGroupMember,
  ItemClaim as DbItemClaim,
  Item as DbItem,
} from '@eezy-receipt/shared';

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
    // claimCount: itemId → number of claimants
    const claimCount = new Map<string, number>();
    for (const c of claims) {
      claimCount.set(c.item_id, (claimCount.get(c.item_id) ?? 0) + 1);
    }

    return members.map((member) => {
      const memberClaims = claims.filter(
        (c) => c.profile_id === member.profile_id,
      );
      const memberItems = memberClaims
        .map((claim) => {
          const item = items.find((i) => i.id === claim.item_id);
          if (!item) return null;
          const amount = claim.share * item.unit_price * (item.amount ?? 1);
          return { name: item.name ?? 'Item', price: amount.toFixed(2) };
        })
        .filter((i): i is { name: string; price: string } => i !== null);
      const subtotal = memberItems.reduce((s, i) => s + parseFloat(i.price), 0);
      const tax = memberClaims.reduce((s, claim) => {
        const perItem = taxPerItem.get(claim.item_id);
        if (perItem == null) return s;
        const n = claimCount.get(claim.item_id) ?? 1;
        return s + perItem / n;
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

      // 1. Mark owing members as 'requested' and finish the group
      await Promise.all(
        owingSummaries.map((s) =>
          updatePaidStatus(roomId, s.profileId, 'requested'),
        ),
      );
      await finishGroup(roomId);

      // 2. Detect guest profiles (empty email = anonymous/guest user)
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

      // 3. Fetch invite link once for all SMS messages
      let inviteUrl = '';
      try {
        const { url } = await createInviteLink(roomId);
        inviteUrl = url;
      } catch {
        inviteUrl = process.env.EXPO_PUBLIC_FRONTEND_URL ?? '';
      }

      // 4. Send SMS for each owing guest (sequential so native compose UI is one-at-a-time)
      for (const s of owingSummaries) {
        if (!guestIds.has(s.profileId)) continue;
        const itemLines = s.items
          .map((i) => `  • ${i.name}: $${i.price}`)
          .join('\n');
        const taxLine = s.tax > 0 ? `\nTax: $${s.tax.toFixed(2)}` : '';
        const total = s.subtotal + s.tax;
        const message =
          `Hi ${s.name}! Here's your receipt summary for "${groupName}":\n\n` +
          itemLines +
          `\n\nSubtotal: $${s.subtotal.toFixed(2)}` +
          taxLine +
          `\nTotal: $${total.toFixed(2)}` +
          (inviteUrl ? `\n\nRejoin the room: ${inviteUrl}` : '');
        await sendSMS(message);
      }

      Alert.alert('Done!', 'Money requests have been sent.', [
        { text: 'OK', onPress: () => router.dismissAll() },
      ]);
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
