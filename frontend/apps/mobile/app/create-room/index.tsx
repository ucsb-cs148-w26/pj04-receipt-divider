import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@eezy-receipt/shared';
import { USER_COLORS } from '@shared/constants';
import * as ImagePicker from 'expo-image-picker';
import * as SMS from 'expo-sms';

interface User {
  id: number;
  name: string;
  source: 'manual' | 'link' | 'qr';
}

export default function CreateRoomScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState('');

  const [roomId] = useState(() => Math.random().toString(36).substring(2, 9));

  const addUser = () => {
    if (!newUserName.trim()) return;
    setUsers((prev) => [
      ...prev,
      { id: prev.length + 1, name: newUserName.trim(), source: 'manual' },
    ]);
    setNewUserName('');
    setShowAddUser(false);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
    setShowPhotoOptions(false);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
    setShowPhotoOptions(false);
  };

  const handleShareSMS = async () => {
    setShowAddOptions(false);
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          'SMS not available',
          'SMS is not available on this device.',
        );
        return;
      }
      const message = `Join my Eezy Receipt room!\n\nRoom ID: ${roomId}\n\nOr tap this link to join: https://example.com/join?roomId=${roomId}`;
      await SMS.sendSMSAsync([], message);
    } catch (error) {
      console.error('SMS error:', error);
    }
  };

  const handleShowQR = () => {
    setShowAddOptions(false);
    router.push(`/qr?roomId=${roomId}`);
  };

  const handleAddManually = () => {
    setShowAddOptions(false);
    Alert.alert(
      'Manual Participant',
      "Adding a participant manually means they won't be linked to a real user account. When someone joins the room via link or QR code, they won't be able to claim this participant as themselves.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Anyway',
          onPress: () => setShowAddUser(true),
        },
      ],
    );
  };

  const handleUserPress = (user: User) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
  };

  const saveUserName = () => {
    if (editingUserId === null) return;
    if (!editUserName.trim()) {
      setEditingUserId(null);
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUserId ? { ...u, name: editUserName.trim() } : u,
      ),
    );
    setEditingUserId(null);
    setEditUserName('');
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Back button */}
      <View className='px-5 pt-2'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
      </View>

      {/* Receipt section — grows to fill space */}
      <View className='flex-1 px-5 mt-3'>
        <Text className='text-foreground text-2xl font-bold mb-3'>Receipt</Text>

        {/* Photo card — flex-1 so it fills available space */}
        <View className='bg-card rounded-2xl flex-1 relative overflow-hidden'>
          <Pressable
            className='absolute top-4 right-4 z-10'
            hitSlop={8}
            onPress={() => setShowPhotoOptions(true)}
          >
            <MaterialCommunityIcons
              name='dots-horizontal'
              size={22}
              color='var(--color-accent-dark)'
            />
          </Pressable>
          {photoUri ? (
            <Pressable
              className='flex-1'
              onPress={() => setShowPhotoOptions(true)}
            >
              <Image
                source={{ uri: photoUri }}
                className='w-full h-full'
                resizeMode='cover'
              />
            </Pressable>
          ) : (
            <Pressable
              className='flex-1 items-center justify-center'
              onPress={() => setShowPhotoOptions(true)}
            >
              <MaterialCommunityIcons
                name='image-outline'
                size={60}
                color='var(--color-accent-dark)'
              />
              <Text className='text-accent-dark mt-3 text-base'>
                add or take photo
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Users section — pinned above Create Room button */}
      <View className='px-5 pt-4 pb-24'>
        <Text className='text-foreground text-2xl font-bold mb-3'>Users</Text>

        {/* Horizontal scroll of user boxes */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
        >
          {users.map((user) => (
            <Pressable
              key={user.id}
              onPress={() => handleUserPress(user)}
              className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10'
              style={{ width: 140 }}
            >
              <View
                className={`h-3 bg-${USER_COLORS[(user.id - 1) % USER_COLORS.length]}`}
              />
              <View className='flex-row items-center gap-3 px-3 py-3'>
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center bg-${USER_COLORS[(user.id - 1) % USER_COLORS.length]}`}
                  style={{ opacity: 0.7 }}
                >
                  <Text className='text-white text-sm font-bold'>
                    {user.id}
                  </Text>
                </View>
                <Text
                  className='text-foreground font-bold text-sm flex-1'
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                {user.source === 'manual' && (
                  <Pressable
                    onPress={() =>
                      setUsers((prev) => prev.filter((u) => u.id !== user.id))
                    }
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name='close'
                      size={14}
                      color='var(--color-accent-dark)'
                    />
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}

          <Pressable
            className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10 items-center justify-center active:opacity-70'
            style={{ width: 100, minHeight: 68 }}
            onPress={() => setShowAddOptions(true)}
          >
            <MaterialCommunityIcons
              name='plus'
              size={28}
              color='var(--color-accent-dark)'
            />
          </Pressable>
        </ScrollView>
      </View>

      {/* Create Room button */}
      <View className='absolute bottom-10 left-5 right-5'>
        <Pressable
          className='bg-primary rounded-2xl py-4 items-center active:opacity-80'
          onPress={() => router.navigate('/receipt-room')}
        >
          <Text className='text-primary-foreground font-bold text-base'>
            Create Room
          </Text>
        </Pressable>
      </View>

      {/* Photo Options Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={showPhotoOptions}
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-end'
          onPress={() => setShowPhotoOptions(false)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-t-2xl p-6'>
              <Text className='text-foreground text-xl font-bold mb-4'>
                Receipt Photo
              </Text>
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleTakePhoto}
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
                onPress={handlePickImage}
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
              {photoUri && (
                <>
                  <View className='h-px bg-border my-1' />
                  <Pressable
                    className='flex-row items-center gap-4 py-3 active:opacity-70'
                    onPress={() => {
                      setPhotoUri(null);
                      setShowPhotoOptions(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name='delete'
                      size={24}
                      color='#ef4444'
                    />
                    <Text className='text-destructive text-base'>
                      Remove Photo
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable
                className='mt-3 py-3 items-center active:opacity-70'
                onPress={() => setShowPhotoOptions(false)}
              >
                <Text className='text-accent-dark text-base font-medium'>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add User Options Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={showAddOptions}
        onRequestClose={() => setShowAddOptions(false)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-end'
          onPress={() => setShowAddOptions(false)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-t-2xl p-6'>
              <Text className='text-foreground text-xl font-bold mb-4'>
                Add Participant
              </Text>
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleShareSMS}
              >
                <MaterialCommunityIcons
                  name='message-text'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>
                  Share Link via SMS
                </Text>
              </Pressable>
              <View className='h-px bg-border my-1' />
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleShowQR}
              >
                <MaterialCommunityIcons
                  name='qrcode'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>
                  Show Room QR Code
                </Text>
              </Pressable>
              <View className='h-px bg-border my-1' />
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleAddManually}
              >
                <MaterialCommunityIcons
                  name='account-plus'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>Add Manually</Text>
              </Pressable>
              <Pressable
                className='mt-3 py-3 items-center active:opacity-70'
                onPress={() => setShowAddOptions(false)}
              >
                <Text className='text-accent-dark text-base font-medium'>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add User (Manual) Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={showAddUser}
        onRequestClose={() => setShowAddUser(false)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-center items-center px-6'
          onPress={() => setShowAddUser(false)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-2xl p-6 w-80'>
              <View className='flex-row items-center justify-between mb-4'>
                <Text className='text-foreground text-xl font-bold'>
                  Add Participant
                </Text>
                <Pressable onPress={() => setShowAddUser(false)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name='close'
                    size={22}
                    color='var(--color-accent-dark)'
                  />
                </Pressable>
              </View>

              <TextInput
                placeholder='Name'
                placeholderTextColor='var(--color-muted-foreground)'
                value={newUserName}
                onChangeText={setNewUserName}
                onSubmitEditing={addUser}
                returnKeyType='done'
                className='border border-border rounded-xl px-4 py-3 text-foreground mb-4'
                autoFocus
              />

              {users.length > 0 && (
                <View className='flex-row flex-wrap gap-2'>
                  {users.map((user) => (
                    <View
                      key={user.id}
                      className={`px-3 py-1 rounded-full border-2 border-${USER_COLORS[(user.id - 1) % USER_COLORS.length]}`}
                    >
                      <Text className='text-foreground text-sm'>
                        {user.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit User Name Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={editingUserId !== null}
        onRequestClose={() => setEditingUserId(null)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-center items-center px-6'
          onPress={() => setEditingUserId(null)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-2xl p-6 w-80'>
              <View className='flex-row items-center justify-between mb-4'>
                <Text className='text-foreground text-xl font-bold'>
                  Edit Name
                </Text>
                <Pressable onPress={() => setEditingUserId(null)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name='close'
                    size={22}
                    color='var(--color-accent-dark)'
                  />
                </Pressable>
              </View>

              <TextInput
                placeholder='Name'
                placeholderTextColor='var(--color-muted-foreground)'
                value={editUserName}
                onChangeText={setEditUserName}
                onSubmitEditing={saveUserName}
                returnKeyType='done'
                className='border border-border rounded-xl px-4 py-3 text-foreground mb-4'
                autoFocus
              />

              <Pressable
                className='bg-primary rounded-xl py-3 items-center active:opacity-80'
                onPress={saveUserName}
              >
                <Text className='text-primary-foreground font-bold'>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
