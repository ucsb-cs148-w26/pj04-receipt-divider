import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@eezy-receipt/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function JoinRoomScreen() {
  const [mode, setMode] = useState<'scan' | 'code'>('scan');
  const [code, setCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleScanned = ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    const roomId = extractRoomId(data);
    if (roomId) {
      navigateToRoom(roomId);
    } else {
      Alert.alert('Invalid QR Code', 'This QR code does not link to a room.', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  const extractRoomId = (url: string): string | null => {
    try {
      // Accept full URL: http://...?roomId=xxx  or just a plain UUID
      const match = url.match(/[?&]roomId=([^&]+)/);
      if (match) return match[1];
      // Plain UUID fallback
      if (/^[0-9a-f-]{36}$/i.test(url.trim())) return url.trim();
    } catch {
      // ignore
    }
    return null;
  };

  const handleJoinByCode = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const roomId = extractRoomId(trimmed) ?? trimmed;
    navigateToRoom(roomId);
  };

  const navigateToRoom = (roomId: string) => {
    router.replace({
      pathname: '/receipt-room',
      params: { roomId, items: '[]', participants: '[]' },
    });
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
          Join Room
        </Text>
        <View className='w-9' />
      </View>

      {/* Tab toggle */}
      <View className='flex-row mx-5 mb-4 border border-border rounded-full overflow-hidden'>
        <Pressable
          onPress={() => setMode('scan')}
          className={`flex-1 py-2 items-center ${mode === 'scan' ? 'bg-card' : ''}`}
        >
          <Text
            className={`font-medium text-sm ${mode === 'scan' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Scan QR Code
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode('code');
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className={`flex-1 py-2 items-center ${mode === 'code' ? 'bg-card' : ''}`}
        >
          <Text
            className={`font-medium text-sm ${mode === 'code' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Enter Code
          </Text>
        </Pressable>
      </View>

      {mode === 'scan' ? (
        <View className='flex-1 mx-5 mb-4 rounded-3xl overflow-hidden bg-card'>
          {!permission ? (
            <View className='flex-1 items-center justify-center gap-3'>
              <ActivityIndicator size='large' color='#546079' />
              <Text className='text-muted-foreground text-sm'>
                Requesting camera permission…
              </Text>
            </View>
          ) : !permission.granted ? (
            <View className='flex-1 items-center justify-center px-8 gap-4'>
              <MaterialCommunityIcons
                name='camera-off'
                size={48}
                className='text-muted-foreground'
              />
              <Text className='text-foreground font-semibold text-base text-center'>
                Camera Access Required
              </Text>
              <Text className='text-muted-foreground text-sm text-center'>
                {`Allow camera access to scan QR codes, or use the "Enter Code" tab instead.`}
              </Text>
              <Pressable
                onPress={requestPermission}
                className='bg-primary rounded-2xl px-6 py-3 mt-2 active:opacity-80'
              >
                <Text className='text-primary-foreground font-semibold'>
                  Allow Camera
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('code')}
                className='rounded-2xl px-6 py-2 active:opacity-80'
              >
                <Text className='text-muted-foreground font-medium'>
                  Enter Code Instead
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing='back'
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned ? undefined : handleScanned}
              />
              {/* Overlay guide */}
              <View
                className='absolute inset-0 items-center justify-center'
                pointerEvents='none'
              >
                <View className='w-56 h-56 border-2 border-white/60 rounded-2xl' />
                <Text className='text-white/80 text-sm mt-4 font-medium'>
                  {scanned ? 'Joining room…' : 'Point at a room QR code'}
                </Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <View className='flex-1 px-5'>
          <View className='bg-card rounded-2xl p-5 mb-4'>
            <Text className='text-foreground font-semibold text-base mb-3'>
              Room Code or ID
            </Text>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={setCode}
              placeholder='Paste a room ID or URL…'
              placeholderTextColor='#8fa4ce'
              autoCapitalize='none'
              autoCorrect={false}
              returnKeyType='go'
              onSubmitEditing={handleJoinByCode}
              className='bg-background rounded-xl px-4 py-3 text-foreground text-base border border-border'
            />
          </View>

          <Pressable
            onPress={handleJoinByCode}
            disabled={!code.trim()}
            className={`rounded-2xl py-4 items-center justify-center flex-row gap-2 ${
              code.trim()
                ? 'bg-primary active:opacity-80'
                : 'bg-card opacity-50'
            }`}
          >
            <MaterialCommunityIcons
              name='login'
              size={20}
              className='text-primary-foreground'
            />
            <Text className='text-primary-foreground font-semibold text-base'>
              Join Room
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
