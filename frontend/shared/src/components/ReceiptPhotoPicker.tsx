import { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ImageCropPopUp from './ImageCropPopUp';
import type { ImageCropPopUpRef } from './ImageCropPopUp';

export interface ReceiptPhotoPickerProps {
  /** URIs of photos already added */
  photoUris: string[];
  /** Called with the URI when the user picks or takes a new photo */
  onPhotoAdded: (_uri: string) => void | Promise<void>;
  /** Called with the URI when the user removes a photo */
  onPhotoRemoved?: (_uri: string) => void;
  /** Show a loading spinner (e.g. while OCR is running) */
  isLoading?: boolean;
  /** Extra className forwarded to the root container */
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable receipt-photo picker.
 *
 * - No photos → displays a prominent empty-state card (same look as
 *   the create-room photo section).
 * - Photos present → horizontal thumbnail strip with an "add" tile.
 * - `isLoading` shows a spinner placeholder while the caller processes
 *   the most recently added photo (e.g. running OCR).
 */
export function ReceiptPhotoPicker({
  photoUris,
  onPhotoAdded,
  onPhotoRemoved,
  isLoading = false,
  className,
  style,
}: ReceiptPhotoPickerProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const cropRef = useRef<ImageCropPopUpRef>(null);

  const openCropPopup = (uri: string) => {
    setPendingUri(uri);
    // Small delay to ensure state is set before opening
    setTimeout(() => cropRef.current?.open(), 50);
  };

  const handleCropComplete = (croppedUri: string) => {
    setPendingUri(null);
    onPhotoAdded(croppedUri);
  };

  const handleCropCancel = () => {
    setPendingUri(null);
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setShowOptions(false);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    setShowOptions(false);
    if (!result.canceled) {
      openCropPopup(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setShowOptions(false);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    setShowOptions(false);
    if (!result.canceled) {
      openCropPopup(result.assets[0].uri);
    }
  };

  const handleTakeNewPhoto = () => {
    setPendingUri(null);
    takePhoto();
  };

  const hasPhotos = photoUris.length > 0;

  return (
    <>
      <View className={className ?? ''} style={style}>
        {!hasPhotos ? (
          /* ── Empty-state card (matches create-room style) ── */
          <View className='bg-card rounded-2xl flex-1 relative overflow-hidden min-h-48'>
            {isLoading ? (
              <View className='flex-1 items-center justify-center gap-3'>
                <ActivityIndicator size='large' color='#546079' />
                <Text className='text-accent-dark text-base'>Processing…</Text>
              </View>
            ) : (
              <Pressable
                className='flex-1 items-center justify-center'
                onPress={() => setShowOptions(true)}
              >
                <MaterialCommunityIcons
                  name='image-outline'
                  size={60}
                  className='text-accent-dark'
                />
                <Text className='text-accent-dark mt-3 text-base'>
                  add or take photo
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          /* ── Thumbnail strip ── */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
          >
            {photoUris.map((uri) => (
              <View
                key={uri}
                className='rounded-2xl overflow-hidden bg-card'
                style={{ width: 120, height: 120 }}
              >
                <Image
                  source={{ uri }}
                  style={{ width: 120, height: 120 }}
                  resizeMode='cover'
                />
                {onPhotoRemoved && (
                  <Pressable
                    className='absolute top-1 right-1 bg-black/60 rounded-full'
                    style={{ padding: 2 }}
                    onPress={() => onPhotoRemoved(uri)}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name='close'
                      size={14}
                      color='white'
                    />
                  </Pressable>
                )}
              </View>
            ))}

            {/* Loading placeholder for the in-flight photo */}
            {isLoading && (
              <View
                className='rounded-2xl bg-card items-center justify-center'
                style={{ width: 120, height: 120 }}
              >
                <ActivityIndicator size='small' color='#546079' />
              </View>
            )}

            {/* Add-more tile */}
            <Pressable
              className='rounded-2xl bg-card items-center justify-center active:opacity-70 border border-dashed border-border'
              style={{ width: 120, height: 120 }}
              onPress={() => setShowOptions(true)}
              disabled={isLoading}
            >
              <MaterialCommunityIcons
                name='plus'
                size={32}
                className='text-accent-dark'
              />
              <Text className='text-accent-dark text-xs mt-1'>add photo</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* ── Options bottom-sheet modal ── */}
      <Modal
        transparent
        animationType='fade'
        visible={showOptions}
        onRequestClose={() => setShowOptions(false)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-end'
          onPress={() => setShowOptions(false)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-t-2xl p-6'>
              <Text className='text-foreground text-xl font-bold mb-4'>
                Receipt Photo
              </Text>
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={takePhoto}
              >
                <MaterialCommunityIcons
                  name='camera'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>Take Photo</Text>
              </Pressable>
              <View className='h-px bg-border my-1' />
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={pickFromLibrary}
              >
                <MaterialCommunityIcons
                  name='image'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>
                  Choose from Library
                </Text>
              </Pressable>
              <Pressable
                className='mt-3 py-3 items-center active:opacity-70'
                onPress={() => setShowOptions(false)}
              >
                <Text className='text-accent-dark text-base font-medium'>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ImageCropPopUp
        ref={cropRef}
        imageUri={pendingUri}
        onComplete={handleCropComplete}
        onCancel={handleCropCancel}
        onTakeNewPhoto={handleTakeNewPhoto}
      />
    </>
  );
}
