import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Button } from '@eezy-receipt/shared';
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
      <Button variant='outlined' 
        onPress={() => {
          router.dismiss();
          router.navigate(`/receipt-room?roomId=${roomId}`);
        }}>Back to Room</Button>
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