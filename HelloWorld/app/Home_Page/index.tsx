import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Button, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Button
        title='Take Photo'
        onPress={() => router.push('../Camera_Page')}
      />
      <Button
        title='Settings'
        onPress={() => router.push('../Settings_Page')}
      />
      <StatusBar style='auto' />
      {/* Globally sets status bar's (the seciton where you see your charge, time, wifi,etc) color scheme to complement the phone's theme (dark/light)*/}
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
