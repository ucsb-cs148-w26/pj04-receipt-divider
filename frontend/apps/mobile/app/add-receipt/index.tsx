import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, ReceiptPhotoPicker } from '@eezy-receipt/shared';
import { File } from 'expo-file-system';
import { extractItems as extractReceiptItems } from '@/services/ocr';
import { useReceiptItems } from '@/providers';

export default function AddReceiptScreen() {
  const receiptItems = useReceiptItems();
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScan = async () => {
    if (photoUris.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const results = await Promise.all(
        photoUris.map(async (uri) => {
          const imageBase64 = await new File(uri).base64();
          return extractReceiptItems(imageBase64);
        }),
      );
      receiptItems.setItems((prev) => [...prev, ...results.flat()]);
      router.back();
    } finally {
      setIsProcessing(false);
    }
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
          disabled={photoUris.length === 0 || isProcessing}
          className={`rounded-2xl py-4 items-center justify-center flex-row gap-2 ${
            photoUris.length === 0 || isProcessing
              ? 'bg-card opacity-50'
              : 'bg-primary active:opacity-80'
          }`}
        >
          {isProcessing ? (
            <ActivityIndicator size='small' color='#ffffff' />
          ) : (
            <MaterialCommunityIcons
              name='text-recognition'
              size={20}
              className='text-primary-foreground'
            />
          )}
          <Text className='text-primary-foreground font-semibold text-base'>
            {isProcessing ? 'Scanning…' : 'Scan & Add Items'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
