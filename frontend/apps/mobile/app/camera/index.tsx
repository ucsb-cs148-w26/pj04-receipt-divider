import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Modal, ActivityIndicator, Text, View } from 'react-native';
import {
  Button,
  ImageCropPopUp,
  type ImageCropPopUpRef,
} from '@eezy-receipt/shared';

import { ReceiptRoomParams } from '@/app/receipt-room/index';
import { useReceiptItems } from '@/providers';

import { randomUUID } from 'expo-crypto';

export default function CameraScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const cropRef = useRef<ImageCropPopUpRef>(null);
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
      setCapturedUri(result.assets[0].uri);
      cropRef.current?.open();
    }
  };

  const handleCropComplete = (_croppedUri: string) => {
    setCapturedUri(null);
    setIsLoading(true);
    goToReceiptRoom();
    setIsLoading(false);
  };

  const handleCropCancel = () => {
    setCapturedUri(null);
  };

  const handleTakeNewPhoto = () => {
    setCapturedUri(null);
    openCamera();
  };

  return (
    <>
      <View className='bg-surface flex-1 justify-center p-5'>
        <View className='bg-surface-elevated rounded-2xl p-6 shadow-sm mb-5'>
          <Text className='text-foreground text-[22px] font-semibold mb-1.5'>
            Take a Photo
          </Text>
          <Text className='text-muted-foreground text-sm mb-5'>
            Use your camera to capture an image
          </Text>
          <Button onPress={openCamera}>Open Camera</Button>
          <Button
            variant='outlined'
            className='mt-3'
            onPress={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            variant='outlined'
            className='mt-3'
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
            <View className='bg-surface-elevated p-6 rounded-xl items-center'>
              <ActivityIndicator size='large' color='#4999DF' />
              <Text className='mt-4 text-lg font-medium text-gray-700'>
                Loading...
              </Text>
            </View>
          </View>
        </Modal>
      </View>

      <ImageCropPopUp
        ref={cropRef}
        imageUri={capturedUri}
        onComplete={handleCropComplete}
        onCancel={handleCropCancel}
        onTakeNewPhoto={handleTakeNewPhoto}
      />
    </>
  );
}
