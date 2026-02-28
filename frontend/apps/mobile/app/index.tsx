import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { IconButton, DefaultButtons } from '@eezy-receipt/shared';

export default function HomeScreen() {
  return (
    <View className='bg-background flex-1 items-center justify-center gap-4'>
      <DefaultButtons.Settings onPress={() => router.navigate('/setting')} />
      <IconButton
        icon='camera-outline'
        bgClassName='bg-blue-500 size-[40vw] shadow-lg'
        iconClassName='text-white size-[25vw]'
        pressEffect='scale'
        onPress={() => router.navigate('/camera')}
      />
      <StatusBar style='auto' />
    </View>
  );
}
