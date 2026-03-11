import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  Share,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IconButton,
  sendSMS,
  getRoomInviteMessage,
  calculateParticipantTotal,
} from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReceiptItems } from '@/providers';
import { useGroupData } from '@/hooks';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { createInviteLink } from '@/services/groupApi';

export default function QRScreen() {
  // Receive room ID from Receipt_Room_Page
  const params = useLocalSearchParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : 'unknown';
  const groupName =
    typeof params.groupName === 'string'
      ? decodeURIComponent(params.groupName)
      : '';
  const currentParticipantId =
    typeof params.currentParticipantId === 'string'
      ? parseInt(params.currentParticipantId, 10)
      : 0;
  const participants: { id: number; name?: string }[] =
    typeof params.participants === 'string'
      ? JSON.parse(decodeURIComponent(params.participants))
      : [];
  const { items } = useReceiptItems();
  const groupData = useGroupData(roomId !== 'unknown' ? roomId : '');
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
    const message = getRoomInviteMessage(roomId, groupName, url);
    void Share.share({ message });
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

    // Exclude the current user, only share other guests' subtotals
    const otherParticipants = participants.filter(
      (p) => p.id !== currentParticipantId,
    );

    if (otherParticipants.length === 0) {
      Alert.alert(
        'No Other Guests',
        'There are no other guests to share subtotals with.',
      );
      return;
    }

    // Build taxPerItemMap: receiptId → tax ÷ item-count for that receipt
    const taxPerItemMap = new Map<string, number>();
    for (const receipt of groupData.receipts) {
      if (receipt.tax == null || receipt.tax <= 0) continue;
      const count = items.filter((i) => i.receiptId === receipt.id).length;
      if (count > 0) taxPerItemMap.set(receipt.id, receipt.tax / count);
    }

    const sections = otherParticipants.map((p) => {
      const name = p.name || `Person ${p.id}`;
      const participantItems = items.filter((item) =>
        item.userTags?.includes(p.id),
      );
      const { subtotal, tax, total } = calculateParticipantTotal(
        p.id,
        participantItems,
        taxPerItemMap,
      );

      const itemLines = participantItems
        .map((item) => {
          const fullPrice = parseFloat(item.price) || 0;
          const claimCount = item.userTags?.length || 1;
          const share = claimCount > 1 ? fullPrice / claimCount : fullPrice;
          return `  • ${item.name || 'Item'}: $${share.toFixed(2)}`;
        })
        .join('\n');

      let section = `${name}:\n${itemLines}\n  Subtotal: $${subtotal.toFixed(2)}`;
      if (tax > 0) {
        section += `\n  Tax:      $${tax.toFixed(2)}`;
      }
      section += `\n  Total:    $${total.toFixed(2)}`;
      return section;
    });

    const header = groupName ? `${groupName} — Subtotals` : 'Subtotals';
    const message = `${header}\n\n${sections.join('\n\n')}`;
    void sendSMS(message);
  }

  const actions: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    label: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'qrcode',
      label: 'Share QR Code',
      onPress: () => void handleShareQRImage(),
    },
    {
      icon: 'link-variant',
      label: 'Share via Link',
      onPress: handleShareJoinLink,
    },
    {
      icon: 'receipt',
      label: 'Share Subtotals',
      onPress: handleShareSubtotals,
    },
  ];

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header */}
      <View className='flex-row items-center px-4 pb-3 pt-2 gap-3'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => {
            router.dismiss();
            router.navigate(`/receipt-room?roomId=${roomId}`);
          }}
        />
        <Text className='text-foreground text-xl font-bold flex-1'>
          Invite to Room
        </Text>
      </View>

      <ScrollView
        className='flex-1 px-4'
        contentContainerClassName='pb-8 gap-4'
        showsVerticalScrollIndicator={false}
      >
        {/* QR Code Card */}
        <View className='bg-card rounded-2xl p-6 items-center gap-4'>
          <View className='rounded-2xl overflow-hidden p-4 bg-white'>
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
              <View className='w-[200px] h-[200px] items-center justify-center'>
                <ActivityIndicator size='large' color='#4999DF' />
              </View>
            )}
          </View>
          <View className='items-center gap-1'>
            <Text className='text-foreground text-base font-semibold'>
              Scan to join this room
            </Text>
            <Text className='text-muted-foreground text-xs'>
              Room ID: {roomId}
            </Text>
          </View>
        </View>

        {/* Action rows */}
        <View className='bg-card rounded-2xl overflow-hidden'>
          {actions.map((action, index) => (
            <View key={action.label}>
              {index > 0 && <View className='h-px bg-border mx-4' />}
              <Pressable
                className='flex-row items-center gap-4 px-4 py-4 active:opacity-70'
                onPress={action.onPress}
              >
                <View className='w-9 h-9 rounded-full bg-primary/10 items-center justify-center'>
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={20}
                    color='#4999DF'
                  />
                </View>
                <Text className='flex-1 text-foreground text-base font-medium'>
                  {action.label}
                </Text>
                <MaterialCommunityIcons
                  name='chevron-right'
                  size={20}
                  color='#888'
                />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
