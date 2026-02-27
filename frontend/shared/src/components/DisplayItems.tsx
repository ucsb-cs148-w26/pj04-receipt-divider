import React from 'react';
import { Text, View } from 'react-native';

export interface DisplayClaimedReceiptItemProps {
  id: string;
  name: string;
  price: string;
  discount?: string; // Optional discount amount
  percentage?: number; // Percentage of the item claimed by the user
}

export function DisplayItems({
  id,
  name,
  price,
  discount,
  percentage,
}: DisplayClaimedReceiptItemProps) {
  const showDiscount = !!discount && parseFloat(discount) > 0;

  return (
    <View className='w-full bg-surface-elevated border border-border rounded-lg p-4 pl-6 pr-6 pb-6 mb-2'>
      <View className='flex-row justify-between items-center gap-2'>
        <View className='bg-card rounded-[10px] px-[10px] py-[6px] items-center justify-center min-w-[50px]'>
          <Text className='text-xs font-bold text-foreground leading-[14px]'>
            {Math.round(percentage || 100)}%
          </Text>
        </View>

        {/* Name Section - left justified*/}
        <View className='flex-1 min-w-0'>
          <Text className='text-foreground'>{name}</Text>
        </View>

        {/* Price - right justified */}
        <View className='items-end justify-end'>
          <Text className='text-foreground font-bold'>${price}</Text>
        </View>
      </View>

      {/* Discount section - lower right justified */}
      {showDiscount && (
        <View className='flex-row items-center justify-end gap-1'>
          <Text className='text-xs text-foreground'>Discount:</Text>
          <Text className='text-sm text-foreground'>${discount}</Text>
        </View>
      )}
    </View>
  );
}
