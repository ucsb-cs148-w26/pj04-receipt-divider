import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, ActivityIndicator, Share } from 'react-native';
import { Button, DefaultButtons, sendSMS } from '@eezy-receipt/shared';
import { useReceiptItems } from '@/providers';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { createInviteLink } from '@/services/groupApi';

export default function QRScreen() {
  // Receive room ID from Receipt_Room_Page
  const params = useLocalSearchParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : 'unknown';
  const participants: { id: number; name?: string }[] =
    typeof params.participants === 'string'
      ? JSON.parse(decodeURIComponent(params.participants))
      : [];
  const { items } = useReceiptItems();
  const qrRef = useRef<QRCode>(null);

  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    if (roomId === 'unknown') return;
    createInviteLink(roomId)
      .then(({ url }) => setQrData(url))
      .catch(() => {
        // Fallback to env var if backend call fails
        setQrData(
          `${process.env.EXPO_PUBLIC_FRONTEND_URL ?? 'http://localhost:5173'}/join?roomId=${roomId}`,
        );
      });
  }, [roomId]);

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
    const url =
      qrData ??
      `${process.env.EXPO_PUBLIC_FRONTEND_URL ?? 'http://localhost:5173'}/join?roomId=${roomId}`;
    void Share.share({ message: url, url });
  }

  function handleShareSubtotals() {
    const unassigned = items.filter(
      (item) => !item.userTags || item.userTags.length === 0,
    );
    if (unassigned.length > 0) {
      Alert.alert(
        'Unassigned Items',
        `The following items have not been assigned to anyone:\n\n${unassigned.map((item) => `• ${item.name || 'Unnamed item'}`).join('\n')}\n\nPlease assign all items before sharing subtotals.`,
        [{ text: 'OK' }],
      );
      return;
    }

    const lines = participants.map((p) => {
      const name = p.name || `Person ${p.id}`;
      let total = 0;
      const itemLines = items
        .filter((item) => item.userTags?.includes(p.id))
        .map((item) => {
          const price = isNaN(parseFloat(item.price.replace(/[^\d.]/g, '')))
            ? 0
            : parseFloat(item.price.replace(/[^\d.]/g, ''));
          const discount = item.discount
            ? parseFloat(item.discount.replace(/[^\d.]/g, ''))
            : 0;
          const share = (price - discount) / item.userTags!.length;
          total += share;
          return `  • ${item.name}: $${share.toFixed(2)}`;
        });
      return `${name}:\n${itemLines.join('\n')}\n  Subtotal: $${total.toFixed(2)}`;
    });

    const grandTotal = items.reduce((sum, item) => {
      const price = isNaN(parseFloat(item.price.replace(/[^\d.]/g, '')))
        ? 0
        : parseFloat(item.price.replace(/[^\d.]/g, ''));
      const discount = item.discount
        ? parseFloat(item.discount.replace(/[^\d.]/g, ''))
        : 0;
      return sum + price - discount;
    }, 0);

    const message = `Subtotals:\n\n${lines.join('\n\n')}\n\n---------------\nTotal: $${grandTotal.toFixed(2)}`;
    handleShareSubtotalSMS(message);
  }

  async function handleShareSubtotalSMS(message: string) {
    try {
      await sendSMS(message);
    } catch (error) {
      console.error('SMS error:', error);
    }
  }

  return (
    <View className='flex-1 bg-background justify-center items-center gap-3'>
      <View className='justify-center items-center'>
        {qrData ? (
          <QRCode
            ref={qrRef}
            value={qrData}
            size={200}
            backgroundColor='white'
            color='black'
            getRef={(c) => (qrRef.current = c)}
          />
        ) : (
          <ActivityIndicator size='large' />
        )}
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
