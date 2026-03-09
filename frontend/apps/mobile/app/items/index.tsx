import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, Pressable, Animated, Alert } from 'react-native';
import {
  DefaultButtons,
  useScrollToInput,
  ScrollableTextInput,
} from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReceiptItemData } from '@shared/types';
import { ReceiptItem } from '@shared/components/ReceiptItem';
import { useReceiptItems } from '@/providers';

export type YourItemsRoomParams = {
  roomId: string;
  items: string;
  participantId: string;
  participantName: string;
};

export default function YourItemScreen() {
  const params = useLocalSearchParams<YourItemsRoomParams>();
  const participantId = parseInt(params.participantId);
  const receiptItemsContext = useReceiptItems();

  const scrollCtx = useScrollToInput({ resetOnBlur: true });

  const [localItems, setLocalItems] = useState<ReceiptItemData[]>(
    JSON.parse(params.items) as ReceiptItemData[],
  );
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(params.participantName ?? '');

  let totalSum = 0;

  function calculatePrices(items: ReceiptItemData[]) {
    items.forEach((item) => {
      const itemPrice = isNaN(parseFloat(item.price))
        ? 0
        : parseFloat(item.price);

      if (item.userTags && item.userTags.length > 1) {
        const currentPercentage = 100 / item.userTags.length;
        let roundedPrice = Math.floor(itemPrice * currentPercentage) / 100;

        const remainderTimes100 = Math.trunc(
          (parseFloat(item.price) - roundedPrice * item.userTags.length) * 100,
        );
        console.log(
          'Rounded Price: ' + roundedPrice,
          'Item name: ' + item.name,
          'Participant ID: ' + participantId,
          'Remainder: ' + remainderTimes100,
        );
        if (participantId > item.userTags.length - remainderTimes100) {
          roundedPrice += 0.01;
        }

        const currentDiscount =
          (item.discount ? parseFloat(item.discount) : 0) *
          currentPercentage *
          0.01;
        item.price = roundedPrice.toFixed(2);
        item.discount = currentDiscount.toFixed(2);
        totalSum += roundedPrice - currentDiscount;
      } else {
        const currentPrice = itemPrice;
        const currentDiscount = item.discount ? parseFloat(item.discount) : 0;
        item.price = currentPrice.toFixed(2);
        item.discount = currentDiscount.toFixed(2);
        totalSum += currentPrice - currentDiscount;
      }
    });
  }

  // Calculate on a copy so we don't mutate localItems state directly
  const displayItems = localItems.map((item) => ({ ...item }));
  calculatePrices(displayItems);

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
  };

  const confirmRemoveItem = (item: ReceiptItemData) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name || 'this item'}" from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeItem(item.id),
        },
      ],
    );
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
        >
          <View className='flex-row items-center w-full py-2'>
            {editingName ? (
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
            )}
          </View>

          {displayItems.map((item) => (
            <ReceiptItem
              key={item.id}
              item={item}
              onUpdate={() => {}}
              onDelete={() => confirmRemoveItem(item)}
              onRemoveFromUser={() => {}}
              isEditMode={false}
              isSelected={false}
              onToggleSelect={() => {}}
            />
          ))}
        </Animated.ScrollView>

        <View className='border-t border-border w-full h-[14vh] flex-row justify-between items-center px-5 pb-[5vh] mt-2'>
          <Text className='text-foreground text-xl font-bold'>Subtotal</Text>
          <Text className='text-foreground text-xl font-bold'>
            ${totalSum.toFixed(2)}
          </Text>
        </View>
      </View>
      <DefaultButtons.Close onPress={() => router.back()} />
    </View>
  );
}
