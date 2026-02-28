import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { DefaultButtons } from '@eezy-receipt/shared';
import { ReceiptItemData } from '@shared/types';
import { DisplayItems } from '@shared/components/DisplayItems';

export type YourItemsRoomParams = {
  roomId: string;
  items: string;
  participantId: string;
};

export default function YourItemScreen() {
  const params = useLocalSearchParams<YourItemsRoomParams>();
  const participantId = parseInt(params.participantId);
  const receiptItems = JSON.parse(params.items) as ReceiptItemData[];
  let totalSum = 0;

  function calculatePrices() {
    // Logic to calculate prices for the participant// Distributes item prices amongst by the number of users who claimed them and calculates total
    receiptItems.forEach((item) => {
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
  calculatePrices();

  return (
    <View className='bg-background size-full'>
      <View className='-bottom-[14vh] h-[88vh] w-full'>
        <ScrollView contentContainerClassName='items-center px-5 gap-[10px]'>
          {receiptItems.map((item) => (
            <DisplayItems
              key={item.id}
              name={item.name}
              price={item.price}
              discount={item.discount}
              percentage={
                item.userTags && item.userTags.length > 0
                  ? 100 / item.userTags.length
                  : 100
              }
            />
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
