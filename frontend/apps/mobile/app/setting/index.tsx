import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Button, DefaultButtons, IconButton } from '@eezy-receipt/shared';
import { useAuth } from '@/providers';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View className='flex-1 justify-center items-center gap-3'>
      <DefaultButtons.Close onPress={() => router.back()} />
      <IconButton
        icon='logout'
        onPress={async () => {
          await signOut();
        }}
        className='bg-secondary rounded-lg w-[35vw] h-[5vh]'
        percentageSize={20}
        pressEffect='fade'
        color='#dcdcdc'
        textPercentageSize={12}
        textColor='#f1f1f1'
        text='  Sign out'
      />
    </View>
  );
}
