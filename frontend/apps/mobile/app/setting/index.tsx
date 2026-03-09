import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@eezy-receipt/shared';
import { useAuth } from '@/providers';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView className='flex-1 bg-background'>
      <View className='flex-row items-center px-5 pt-2 pb-3'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
      </View>
      <View className='flex-1 justify-center items-center gap-3'>
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
    </SafeAreaView>
  );
}
