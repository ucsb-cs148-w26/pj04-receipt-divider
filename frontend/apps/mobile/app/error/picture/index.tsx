import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Button } from '@eezy-receipt/shared';

export default function PictureErrorScreen() {
  return (
    <View className='flex-1 justify-center items-center'>
      <Button
        onPress={() => {
          router.dismiss();
          router.navigate('/');
        }}
      >
        Back to Home Page
      </Button>
      <Button
        variant='outlined'
        onPress={() => {
          router.dismiss();
          router.navigate('/camera');
        }}
      >
        Back to Camera
      </Button>
    </View>
  );
}
