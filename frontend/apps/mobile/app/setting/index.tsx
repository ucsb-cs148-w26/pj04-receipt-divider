import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Button, DefaultButtons, IconButton } from '@eezy-receipt/shared';
import { useAuth } from '@/providers';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View className='flex-1 bg-background justify-center items-center gap-3'>
      <DefaultButtons.Close onPress={() => router.back()} />
      <IconButton
        icon='logout'
        onPress={async () => {
          await signOut();
        }}
        bgClassName='bg-secondary rounded-lg w-[35vw] h-[5vh]'
        iconClassName='text-background size-[7vw]'
        text='Sign out'
        textClassName='text-background text-[4vw]'
        pressEffect='fade'
      />
    </View>
  );
}
