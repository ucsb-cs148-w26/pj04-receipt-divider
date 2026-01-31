import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function QRScreen() {
  // Receive room ID from Receipt_Room_Page
  const params = useLocalSearchParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : 'unknown';

  // The URL encoded in the QR code
  const qrData = `helloworld://Receipt_Room_Page?roomId=${roomId}`;

  return (
    <View style={styles.container}>
      <View style={styles.qrContainer}>
        <QRCode
          value={qrData}
          size={200}
          backgroundColor='white'
          color='black'
        />
        <Text style={styles.roomIdText}>Room ID: {roomId}</Text>
      </View>
      <Button
        title='Back to Room'
        onPress={() => {
          router.dismiss();
          router.navigate(`/Receipt_Room_Page?roomId=${roomId}`);
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
  qrContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomIdText: {
    fontSize: 16,
    marginTop: 20,
    backgroundColor: 'white',
    color: 'black',
  },
});
