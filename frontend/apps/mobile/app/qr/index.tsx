import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Button } from '@eezy-receipt/shared';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as SMS from 'expo-sms';

export default function QRScreen() {
  // Receive room ID from Receipt_Room_Page
  const params = useLocalSearchParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : 'unknown';
  const qrRef = useRef<QRCode>(null);

  // The URL encoded in the QR code
  const qrData = `helloworld://Receipt_Room_Page?roomId=${roomId}`;

  async function handleShareQRImage() {
    try {
      if (!qrRef.current) {
        console.error('QR code ref is not available');
        return;
      }

      // Capture the QR code directly using its ref
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing is not available');
        return;
      }
      // Share the captured QR code with prefilled text
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Join my receipt room! Room ID: ${roomId}`,
        UTI: 'public.png',
        // Add the text content
      });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  }

  async function handleShareSMS() {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        console.log('SMS is not available');
        return;
      }

      const message = `Join my Eezy Receipt room!\nRoom ID: ${roomId}\n\n🔗 Or tap this link to join: https://example.com/`;

      await SMS.sendSMSAsync([], message);
    } catch (error) {
      console.error('SMS error:', error);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.qrContainer}>
        <QRCode
          ref={qrRef}
          value={qrData}
          size={200}
          backgroundColor='white'
          color='black'
          getRef={(c) => (qrRef.current = c)}
        />
        <Text style={styles.roomIdText}>Room ID: {roomId}</Text>
      </View>
      <Button variant='primary' onPress={handleShareQRImage}>
        Share QR Code
      </Button>
      <Button variant='primary' onPress={handleShareSMS}>
        Share via SMS
      </Button>
      <Button
        variant='outlined'
        onPress={() => {
          router.dismiss();
          router.navigate(`/receipt-room?roomId=${roomId}`);
        }}
      >
        Back to Room
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
  qrContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  roomIdText: {
    fontSize: 16,
    marginTop: 20,
    color: 'black',
    fontWeight: 'bold',
  },
});
