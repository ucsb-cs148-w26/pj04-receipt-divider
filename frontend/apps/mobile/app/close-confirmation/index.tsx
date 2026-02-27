import { router } from 'expo-router';
import React from 'react';
import { View, Text } from 'react-native';
import { useReceiptItems } from '@/providers';
import { Button } from '@eezy-receipt/shared';

export default function CloseConfirmationScreen() {
  const receiptItems = useReceiptItems();

  const handleCancel = () => {
    // Navigate back to receipt room
    router.back();
  };

  const handleConfirm = () => {
    // Clear receipt items before closing
    receiptItems.setItems([]);

    // Dismiss all pages and go to home
    router.dismissAll();
    router.navigate('/');
  };

  return (
    <View className='bg-black/50 flex-1 justify-center items-center p-5'>
      <View className='bg-card rounded-2xl p-6 w-full max-w-[400px] shadow-lg'>
        <Text className='text-card-foreground text-2xl font-bold mb-3 text-center'>
          Close Room?
        </Text>
        <Text className='text-card-foreground text-base mb-6 text-center leading-[22px]'>
          Are you sure you want to close this room?
        </Text>

        <View className='flex-row gap-3'>
          <Button variant='outlined' className='flex-1' onPress={handleCancel}>
            Cancel
          </Button>
          <Button className='flex-1 bg-destructive' onPress={handleConfirm}>
            Close Room
          </Button>
        </View>
      </View>
    </View>
  );
}
