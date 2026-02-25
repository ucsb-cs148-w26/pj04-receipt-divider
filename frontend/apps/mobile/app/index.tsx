import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton, DefaultButtons } from '@eezy-receipt/shared';

export default function HomeScreen() {
  return (
    <View className='flex-1 items-center justify-center gap-4'>
      <DefaultButtons.Settings onPress={() => router.navigate('/setting')} />
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
