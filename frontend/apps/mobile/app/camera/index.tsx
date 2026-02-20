import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { File } from 'expo-file-system';
import { Button } from '@eezy-receipt/shared';

import { ReceiptRoomParams } from '@/app/receipt-room/index';
import { useReceiptItems } from '@/providers';

import { ErrorMessage, extractItems as extractReceiptItems } from '@/services/ocr';
import { randomUUID } from 'expo-crypto';
import { ErrorPictureParams } from '../error/picture';


export default function CameraScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const receiptItems = useReceiptItems();

  const goToReceiptRoom = () => {
    if (receiptItems.items === null) receiptItems.setItems([]);
    router.push({
      pathname: '/receipt-room',
      params: {
        roomId: randomUUID(),
      } as ReceiptRoomParams,
    });
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const mediaTypes: ImagePicker.MediaType[] = ['images'];
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes,
      quality: 1,
    });

    if (!result.canceled) {
      const imageBase64 = await new File(result.assets[0].uri).base64();
      setIsLoading(true);
      const extractedItems = await extractReceiptItems(imageBase64);
      if(extractedItems instanceof ErrorMessage) { 
        setIsLoading(false);
        router.push({
          pathname: '/error/picture',
          params: { message: extractedItems.message } as ErrorPictureParams,
        });
        return;
      }
      receiptItems.setItems(extractedItems);
      setIsLoading(false);
      goToReceiptRoom();
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Take a Photo</Text>
          <Text style={styles.subtitle}>
            Use your camera to capture an image
          </Text>
          <Button onPress={openCamera}>Open Camera</Button>
          <Button
            variant='outlined'
            style={styles.spacer}
            onPress={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            variant='outlined'
            style={styles.spacer}
            onPress={() => goToReceiptRoom()}
          >
            Skip
          </Button>
        </View>
        <Modal
          transparent
          animationType='fade'
          visible={isLoading}
          statusBarTranslucent
        >
          <View className='flex-1 justify-center items-center bg-black/50'>
            <View className='bg-white p-6 rounded-xl items-center'>
              <ActivityIndicator size='large' color='#4f46e5' />
              <Text className='mt-4 text-lg font-medium text-gray-700'>
                Loading...
              </Text>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryText: {
    fontSize: 16,
    color: '#334155',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  uriText: {
    fontSize: 12,
    color: '#64748B',
  },
  spacer: {
    marginTop: 12,
  },
});
