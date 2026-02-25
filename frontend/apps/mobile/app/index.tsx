import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton, SettingsButton } from '@eezy-receipt/shared';

export default function HomeScreen() {
  return (
    <View className='flex-1 items-center justify-center gap-4'>
      <View className='absolute top-[6vh] right-[4vw]'>
        <SettingsButton onPress={() => router.navigate('/setting')} />
      </View>
      <IconButton
        icon='camera-outline'
        percentageSize={60}
        color='#f8f8f8'
        pressEffect='scale'
        onPress={() => router.navigate('/camera')}
        className='bg-blue-500 size-[40vw] shadow-lg'
      />
      <StatusBar style='auto' />
    </View>
  );
}
