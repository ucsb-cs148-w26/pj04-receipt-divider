import { router, Stack, useSegments } from 'expo-router';
import 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';

import '@styles/global.css';
import { AuthProvider, ReceiptItemsProvider, useAuth } from '@/providers';

function AuthGate() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const onLoginScreen = segments[0] === 'login';
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    // Mark initial load as done after first auth check
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      console.log('Initial auth load complete');
    }

    // Only navigate on auth state changes, not during hot reload
    const inAuthGroup = segments[0] === 'login';

    if (!session && !inAuthGroup) {
      console.log('No session, navigating to login');
      router.replace('/login');
    } else if (session && inAuthGroup) {
      console.log('Session exists, navigating to home');
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isLoading]);

  console.log(
    'AuthGate - session:',
    !!session,
    'isLoading:',
    isLoading,
    'onLoginScreen:',
    onLoginScreen,
  );

  return (
    <>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' />
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name='modal'
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
    </>
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
