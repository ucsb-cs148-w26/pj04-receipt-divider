import { Stack } from 'expo-router';
import 'react-native-reanimated';

export default function CloseConfirmationLayout() {
  return (
    <Stack>
      <Stack.Screen name='index' options={{ headerShown: false }} />
    </Stack>
  );
}
