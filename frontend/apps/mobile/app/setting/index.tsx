import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@eezy-receipt/shared';
import { useAuth } from '@/providers';
import { Button, DefaultButtons } from '@eezy-receipt/shared';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <DefaultButtons.Close onPress={() => router.back()} />
      <Button variant='outlined' onPress={() => router.back()}>
        Back
      </Button>
      <Button
        variant='secondary'
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      >
        Sign out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});
