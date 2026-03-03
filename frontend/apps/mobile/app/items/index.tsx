import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, ScrollView, Text, Pressable } from 'react-native';
import { DefaultButtons } from '@eezy-receipt/shared';
import { ReceiptItemData } from '@shared/types';
import { DisplayItems } from '@shared/components/DisplayItems';
import { useReceiptItems } from '@/providers';

export type YourItemsRoomParams = {
  roomId: string;
  items: string;
  participantId: string;
};

export default function YourItemScreen() {
  const params = useLocalSearchParams<YourItemsRoomParams>();
  const participantId = parseInt(params.participantId);
  const receiptItemsContext = useReceiptItems();

  const [localItems, setLocalItems] = useState<ReceiptItemData[]>(
    JSON.parse(params.items) as ReceiptItemData[],
  );

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

  return (
    <View className='bg-background size-full'>
      <View className='-bottom-[14vh] h-[88vh] w-full'>
        <ScrollView contentContainerClassName='items-center px-5 gap-[10px]'>
          {displayItems.map((item) => (
            <View key={item.id} className='flex-row items-center w-full gap-2'>
              <Pressable
                onPress={() => removeItem(item.id)}
                className='p-2'
                accessibilityLabel='Remove item'
              >
                <Text className='text-destructive text-xl font-bold'>✕</Text>
              </Pressable>
              <View className='flex-1'>
                <DisplayItems
                  name={item.name}
                  price={item.price}
                  discount={item.discount}
                  percentage={
                    item.userTags && item.userTags.length > 0
                      ? 100 / item.userTags.length
                      : 100
                  }
                />
              </View>
            </View>
          ))}
        </ScrollView>

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
