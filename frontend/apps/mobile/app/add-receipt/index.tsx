import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, ReceiptPhotoPicker } from '@eezy-receipt/shared';
import { setPendingReceiptPhotos } from '@/services/pendingReceiptPhotos';

export default function AddReceiptScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  const handleScan = () => {
    if (photoUris.length === 0) return;
    if (!groupId) {
      Alert.alert('No Group', 'Receipt scanning requires an active group.');
      return;
    }
    // Hand photos to the receipt-room and navigate back immediately so the
    // receipt-room can display the "Processing receipt…" banner while uploading.
    setPendingReceiptPhotos(photoUris);
    router.back();
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header */}
      <View className='flex-row items-center px-5 pt-2 pb-3'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
        <Text className='flex-1 text-center text-foreground text-xl font-bold'>
          Add Receipt
        </Text>
        {/* Spacer to balance the back button */}
        <View className='w-9' />
      </View>

      {/* Photo picker — fills all available space */}
      <View className='flex-1 px-5 pb-4'>
        <ReceiptPhotoPicker
          photoUris={photoUris}
          onPhotoAdded={(uri) => setPhotoUris((prev) => [...prev, uri])}
          onPhotoRemoved={(uri) =>
            setPhotoUris((prev) => prev.filter((u) => u !== uri))
          }
          className='flex-1'
        />
      </View>

      {/* Scan button */}
      <View className='px-5 pb-6'>
        <Pressable
          onPress={handleScan}
          disabled={photoUris.length === 0}
          className={`rounded-2xl py-4 items-center justify-center flex-row gap-2 ${
            photoUris.length === 0
              ? 'bg-card opacity-50'
              : 'bg-primary active:opacity-80'
          }`}
        >
          <MaterialCommunityIcons
            name='text-recognition'
            size={20}
            className='text-primary-foreground'
          />
          <Text className='text-primary-foreground font-semibold text-base'>
            Scan & Add Items
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
