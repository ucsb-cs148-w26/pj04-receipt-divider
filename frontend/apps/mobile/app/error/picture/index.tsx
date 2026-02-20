import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@eezy-receipt/shared';

export type ErrorPictureParams = {
  message: string;
};

export default function PictureErrorScreen() {
  const params = useLocalSearchParams<ErrorPictureParams>();
  
  return (
    <View style={styles.container}>
      <View className='flex flex-col rounded-2xl w-[80%] bg-[#ffffff] shadow-xl'>
        <View className='flex flex-col p-8'>
          <Text className='text-2xl font-bold   text-[#374151] pb-6'>
            Receipt Processing Error:
          </Text>
          <Text className='mt-4 text-sm font-medium text-gray-700'>
            Error details: {params.message}
          </Text>
        </View>
      </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
