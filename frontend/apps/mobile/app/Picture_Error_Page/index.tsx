import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from 'react-native';

export default function PictureErrorScreen() {
  return (
    <View style={styles.container}>
      <Button
        title='Back to Home Page'
        onPress={() => {
          router.dismiss();
          router.navigate('../Home_Page');
        }}
      />
      <Button
        title='Back to Camera'
        onPress={() => {
          router.dismiss();
          router.navigate('../Camera_Page');
        }}
      />
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
