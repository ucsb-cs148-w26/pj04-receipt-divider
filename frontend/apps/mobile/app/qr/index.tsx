import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef } from 'react';
import { View, Text } from 'react-native';
import { Button, DefaultButtons } from '@eezy-receipt/shared';
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
  // TODO: currently using local web,
  // will need change to vercel deployment
  const qrData = `http://localhost:5173/join?roomId=${roomId}`;

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

  function handleShareJoinLink() {
    //TODO: GET THE ACTUAL JOIN LINK INSTEAD OF THE PLACEHOLDER
    //ALSO MAYBE REMOVE ROOM ID IF WE DON'T NEED IT

    const message = `Join my Eezy Receipt room!\n\nRoom ID: ${roomId}\n\nOr tap this link to join: https://example.com/`;
    handleShareSMS(message);
  }

  function handleShareSubtotals() {
    //TODO: THIS BUTTON SHOULDN'T BE HERE
    //TODO: CANNOT SEND SUBTOTALS UNTIL EVERY ITEM IS CLAIMED && HOST CONFIRMS SPLIT IS FINALIZED
    //TODO: GET THE ACTUAL SUBTOTALS INSTEAD OF THE PLACEHOLDER
    //TODO: GET THE ROOM NAME TOO

    const message = `Subtotals for Room:
    [Costco Trip]
    ---------------
      Alice: $10.00
      Bob: $15.00
      Charlie: $5.00
    ---------------
    Total: $30.00`;
    handleShareSMS(message);
  }

  async function handleShareSMS(message: string) {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        console.log('SMS is not available');
        return;
      }
      await SMS.sendSMSAsync([], message);
    } catch (error) {
      console.error('SMS error:', error);
    }
  }

  return (
    <View className='flex-1 bg-background justify-center items-center gap-3'>
      <View className='justify-center items-center'>
        <QRCode
          ref={qrRef}
          value={qrData}
          size={200}
          backgroundColor='white'
          color='black'
          getRef={(c) => (qrRef.current = c)}
        />
        <Text className='bg-surface-elevated text-foreground text-base mt-5'>
          Room ID: {roomId}
        </Text>
      </View>
      <Button variant='primary' onPress={handleShareQRImage}>
        Share QR Code
      </Button>
      <Button variant='primary' onPress={handleShareJoinLink}>
        Share via Link
      </Button>
      <Button variant='primary' onPress={handleShareSubtotals}>
        Share Subtotals
      </Button>
      <DefaultButtons.Close
        onPress={() => {
          router.dismiss();
          router.navigate(`/receipt-room?roomId=${roomId}`);
        }}
      />
    </View>
  );
}
