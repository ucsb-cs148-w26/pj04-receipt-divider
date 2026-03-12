import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Animated, RefreshControl } from 'react-native';
import {
  DefaultButtons,
  useScrollToInput,
  ScrollableTextInput,
  calculateParticipantShare,
  calculateParticipantTotal,
  splitAmountByRank,
} from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReceiptItemData } from '@shared/types';
import { DisplayItems } from '@shared/components/DisplayItems';
import { useReceiptItems } from '@/providers';
import { unassignItem } from '@/services/groupApi';

export type YourItemsRoomParams = {
  roomId: string;
  items: string;
  participantId: string;
  participantName: string;
  /** Supabase profile_id for this participant (group rooms only) */
  profileId: string;
  /** JSON: Record<receiptId, taxPerItem> — evenly split tax per item in that receipt */
  taxPerItem?: string;
  /** When true, the remove-item button is hidden (used when viewing another participant's items) */
  isReadOnly?: string;
  /** When true, the current user is the host */
  isHost?: string;
  /** When true, the viewed participant is a guest profile */
  isGuest?: string;
};

export default function YourItemScreen() {
  const params = useLocalSearchParams<YourItemsRoomParams>();
  const participantId = parseInt(params.participantId);
  const profileId = params.profileId ?? '';
  const isGroupRoom = !!params.roomId && /^[0-9a-f-]{36}$/i.test(params.roomId);
  const isReadOnly = params.isReadOnly === 'true';
  const canRename = params.isHost === 'true' && params.isGuest === 'true';
  const receiptItemsContext = useReceiptItems();

  const scrollCtx = useScrollToInput({ resetOnBlur: true });

  const [localItems, setLocalItems] = useState<ReceiptItemData[]>(
    JSON.parse(params.items) as ReceiptItemData[],
  );
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(params.participantName ?? '');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Re-derive items from the shared receipt context (kept in sync with realtime)
    const refreshedItems = receiptItemsContext.items.filter((item) =>
      item.userTags?.includes(participantId),
    );
    setLocalItems(refreshedItems);
    setRefreshing(false);
  }, [receiptItemsContext.items, participantId]);

  // taxPerItem: receiptId → tax per item in that receipt (evenly split)
  const taxPerItemMap: Record<string, number> = params.taxPerItem
    ? (JSON.parse(params.taxPerItem) as Record<string, number>)
    : {};

  const { subtotal: totalSum, tax: totalTax } = calculateParticipantTotal(
    participantId,
    localItems,
    taxPerItemMap,
  );

  // Display copy: per-item prices adjusted to this participant's share (for rendering rows)
  const displayItems = localItems.map((item) => {
    const itemPrice = parseFloat(item.price) || 0;
    const claimantIds = item.userTags;
    const claimCount =
      claimantIds && claimantIds.length > 1 ? claimantIds.length : 1;
    const priceShare = calculateParticipantShare(
      itemPrice,
      claimCount,
      participantId,
      claimantIds,
    );
    const discountFull = parseFloat(item.discount || '0') || 0;
    const sorted = claimantIds ? [...claimantIds].sort((a, b) => a - b) : [];
    const rank = sorted.length > 0 ? sorted.indexOf(participantId) + 1 || 1 : 1;
    const discountShare =
      claimCount > 1
        ? splitAmountByRank(discountFull, claimCount, rank)
        : discountFull;
    return {
      ...item,
      price: priceShare.toFixed(2),
      discount: discountShare.toFixed(2),
    };
  });

  // Percentage each item represents for this participant
  const percentages = Object.fromEntries(
    localItems.map((item) => [
      item.id,
      item.userTags && item.userTags.length > 1
        ? Math.round(100 / item.userTags.length)
        : 100,
    ]),
  );

  const removeItem = (itemId: string) => {
    receiptItemsContext.setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              userTags: item.userTags?.filter((tag) => tag !== participantId),
            }
          : item,
      ),
    );
    setLocalItems((prev) => prev.filter((item) => item.id !== itemId));
    if (isGroupRoom && profileId)
      unassignItem(itemId, profileId).catch((err) => {
        console.error(err);
      });
  };

  return (
    <View className='bg-background size-full'>
      <View className='-bottom-[14vh] h-[88vh] w-full'>
        <Animated.ScrollView
          contentContainerClassName='items-center px-5 gap-[10px]'
          ref={scrollCtx.scrollViewRef}
          onScroll={scrollCtx.trackScrollOffset}
          scrollEventThrottle={16}
          onContentSizeChange={scrollCtx.onContentSizeChange}
          contentContainerStyle={{ paddingBottom: scrollCtx.bottomPadding }}
          refreshControl={
            isGroupRoom ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            ) : undefined
          }
        >
          <View className='flex-row items-center w-full py-2'>
            {canRename ? (
              editingName ? (
                <>
                  <ScrollableTextInput
                    scrollContext={scrollCtx}
                    name='participant-name'
                    value={nameValue}
                    onChangeText={setNameValue}
                    className='flex-1 border border-border rounded-xl px-4 py-2 text-foreground text-xl font-bold'
                    autoFocus
                    returnKeyType='done'
                    onSubmitEditing={() => setEditingName(false)}
                  />
                  <Pressable
                    onPress={() => setEditingName(false)}
                    className='ml-2 p-2'
                    accessibilityLabel='Confirm name change'
                  >
                    <Text className='text-primary text-base font-semibold'>
                      Done
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => setEditingName(true)}
                  className='flex-row items-center gap-2'
                  accessibilityLabel='Edit participant name'
                >
                  <Text className='text-foreground text-xl font-bold'>
                    {nameValue || 'Participant'}
                  </Text>
                  <MaterialCommunityIcons
                    name='pencil-outline'
                    size={18}
                    className='text-muted-foreground'
                  />
                </Pressable>
              )
            ) : (
              <Text className='text-foreground text-xl font-bold'>
                {nameValue || 'Participant'}
              </Text>
            )}
          </View>

          {displayItems.map((item) => (
            <DisplayItems
              key={item.id}
              name={item.name}
              price={item.price}
              discount={item.discount}
              percentage={percentages[item.id]}
              onRemove={isReadOnly ? undefined : () => removeItem(item.id)}
            />
          ))}
        </Animated.ScrollView>

        <View className='border-t border-border w-full px-5 pb-[5vh] mt-2 pt-3 gap-1'>
          <View className='flex-row justify-between items-center'>
            <Text className='text-muted-foreground text-base'>Subtotal</Text>
            <Text className='text-muted-foreground text-base'>
              ${totalSum.toFixed(2)}
            </Text>
          </View>
          {totalTax > 0 && (
            <View className='flex-row justify-between items-center'>
              <Text className='text-muted-foreground text-base'>Tax</Text>
              <Text className='text-muted-foreground text-base'>
                ${totalTax.toFixed(2)}
              </Text>
            </View>
          )}
          <View className='flex-row justify-between items-center mt-1'>
            <Text className='text-foreground text-xl font-bold'>
              {totalTax > 0 ? 'Total' : 'Subtotal'}
            </Text>
            <Text className='text-foreground text-xl font-bold'>
              ${(totalSum + totalTax).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
      <DefaultButtons.Close onPress={() => router.back()} />
    </View>
  );
}
