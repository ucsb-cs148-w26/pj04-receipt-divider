import { Redirect, Stack, useSegments } from 'expo-router';
import 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import '@styles/global.css';
import { AuthProvider, ReceiptItemsProvider, useAuth } from '@/providers';

function AuthGate() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const onLoginScreen = segments[0] === 'login';

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' />
      </View>
    );
  }

  if (!session && !onLoginScreen) {
    return <Redirect href='/login' />;
  }

  if (session && onLoginScreen) {
    return <Redirect href='/' />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name='modal'
        options={{ presentation: 'modal', title: 'Modal' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ReceiptItemsProvider>
        <AuthGate />
      </ReceiptItemsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
