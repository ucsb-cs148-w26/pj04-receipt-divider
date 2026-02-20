import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Button } from '@eezy-receipt/shared';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Button onPress={() => router.navigate('/camera')}>Take Photo</Button>
      <Button variant='secondary' onPress={() => router.navigate('/setting')}>Settings</Button>
      <StatusBar style='auto' />
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