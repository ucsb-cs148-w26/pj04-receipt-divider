import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@eezy-receipt/shared';

export default function PictureErrorScreen() {
  return (
    <View style={styles.container}>
      <Button
        onPress={() => {
          router.dismiss();
          router.navigate('/');
        }}
      >
        Back to Home Page
      </Button>
      <Button
        variant='outlined'
        onPress={() => {
          router.dismiss();
          router.navigate('/camera');
        }}
      >
        Back to Camera
      </Button>
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
