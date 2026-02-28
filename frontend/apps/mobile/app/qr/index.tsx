import { router, useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';
import { DefaultButtons } from '@eezy-receipt/shared';
import QRCode from 'react-native-qrcode-svg';

export default function QRScreen() {
  // Receive room ID from Receipt_Room_Page
  const params = useLocalSearchParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : 'unknown';

  // The URL encoded in the QR code
  const qrData = `helloworld://Receipt_Room_Page?roomId=${roomId}`;

  return (
    <View className='flex-1 bg-background justify-center items-center gap-3'>
      <View className='justify-center items-center'>
        <QRCode
          value={qrData}
          size={200}
          backgroundColor='white'
          color='black'
        />
        <Text className='bg-surface-elevated text-foreground text-base mt-5'>
          Room ID: {roomId}
        </Text>
      </View>
      <DefaultButtons.Close
        onPress={() => {
          router.dismiss();
          router.navigate(`/receipt-room?roomId=${roomId}`);
        }}
      />
    </View>
  );
}
