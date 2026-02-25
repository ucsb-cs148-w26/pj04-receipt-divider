import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, DefaultButtons } from '@eezy-receipt/shared';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <DefaultButtons.Close onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
