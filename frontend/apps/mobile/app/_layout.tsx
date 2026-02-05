import { Stack } from 'expo-router';
import 'react-native-reanimated';

import '@styles/global.css';
import { ReceiptItemsProvider } from '@/providers';

export default function RootLayout() {
  return (
    <ReceiptItemsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name='modal'
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
    </ReceiptItemsProvider>
  );
}
