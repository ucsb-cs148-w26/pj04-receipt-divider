import { Stack } from 'expo-router';
import 'react-native-reanimated';

import '@/global.css';
import { ReceiptProvider } from '../contexts/ReceiptContext';

export default function RootLayout() {
  return (
    <ReceiptProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name='modal'
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
    </ReceiptProvider>
  );
}
