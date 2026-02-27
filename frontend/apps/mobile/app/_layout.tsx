import { router, Stack, useSegments } from 'expo-router';
import 'react-native-reanimated';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useRef } from 'react';

import '@styles/global.css';
import { AuthProvider, ReceiptItemsProvider, useAuth } from '@/providers';
import { useColorScheme } from '@/hooks/use-color-scheme';

function AuthGate() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const hasNavigated = useRef(false);
  const onLoginScreen = segments[0] === 'login';

  useEffect(() => {
    // Don't navigate during initial loading
    if (isLoading) {
      return;
    }

    // Prevent redirect loops during hot reload
    if (hasNavigated.current) {
      hasNavigated.current = false;
      return;
    }

    if (!session && !onLoginScreen) {
      hasNavigated.current = true;
      if (segments.length > 0) {
        router.dismissAll();
      }
      router.replace('/login');
      console.log('Not authorized, navigating to login');
    } else if (session && onLoginScreen) {
      hasNavigated.current = true;
      router.replace('/');
      console.log('Authorization successful, navigating to home');
    }
  }, [session, isLoading, onLoginScreen, segments]);
  return (
    <>
      {isLoading && (
        <View className='flex-1 flex-center justify-center'>
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
  const colorScheme = useColorScheme();

  return (
    <View className={`flex-1 ${colorScheme === 'dark' ? 'dark' : ''}`}>
      <AuthProvider>
        <ReceiptItemsProvider>
          <AuthGate />
        </ReceiptItemsProvider>
      </AuthProvider>
    </View>
  );
}
