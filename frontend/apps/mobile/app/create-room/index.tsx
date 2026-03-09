import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IconButton,
  ReceiptPhotoPicker,
  sendRoomInviteSMS,
  AddParticipantSheet,
  AddParticipantManualModal,
} from '@eezy-receipt/shared';
import { USER_COLORS } from '@shared/constants';
import QRCode from 'react-native-qrcode-svg';
import { randomUUID } from 'expo-crypto';

interface User {
  id: number;
  name: string;
  source: 'manual' | 'link' | 'qr';
}

export default function CreateRoomScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState('');

  //FIXME: MOCK ROOMID, SHOULD BE TAKEN FROM THE BACKEND
  const [roomId] = useState(() => randomUUID());
  const [showQRModal, setShowQRModal] = useState(false);
  const qrData = `http://localhost:5173/join?roomId=${roomId}`;
  const qrRef = useRef<QRCode>(null);

  const addUser = (name: string) => {
    setUsers((prev) => [
      ...prev,
      { id: prev.length + 1, name, source: 'manual' },
    ]);
  };

  const handleShareSMS = async () => {
    try {
      const result = await sendRoomInviteSMS(roomId);
      if (result === 'sent') {
        setShowAddOptions(false);
      }
    } catch (error) {
      console.error('SMS error:', error);
    }
  };

  const handleShowQR = () => {
    setShowAddOptions(false);
    setShowQRModal(true);
  };

  const handleAddManually = () => {
    Alert.alert(
      'Manual Participant',
      "Adding a participant manually means they won't be linked to a real user account. When someone joins the room via link or QR code, they won't be able to claim this participant as themselves.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Anyway',
          onPress: () => {
            setShowAddOptions(false);
            setShowAddUser(true);
          },
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

        {/* Photo picker — flex-1 so it fills available space */}
        <ReceiptPhotoPicker
          photoUris={photoUris}
          onPhotoAdded={(uri) => setPhotoUris((prev) => [...prev, uri])}
          onPhotoRemoved={(uri) =>
            setPhotoUris((prev) => prev.filter((u) => u !== uri))
          }
          className='flex-1'
        />
      </View>

      {/* Users section — pinned above Create Room button */}
      <View className='px-5 pt-4 pb-24'>
        <Text className='text-foreground text-2xl font-bold mb-3'>Users</Text>

        {/* Horizontal scroll of user boxes */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
          style={{ height: 84 }}
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
                      className='text-accent-dark'
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
              className='text-accent-dark'
            />
          </Pressable>
        </ScrollView>
      </View>

      {/* Create Room button */}
      <View className='absolute bottom-10 left-5 right-5'>
        <Pressable
          className='bg-primary rounded-2xl py-4 items-center active:opacity-80'
          onPress={() => {
            if (photoUris.length === 0) {
              Alert.alert(
                'No Receipt Photo',
                'Please add at least one receipt photo before creating a room.',
              );
              return;
            }
            router.navigate({
              pathname: '/receipt-room',
              params: {
                participants: JSON.stringify(
                  users.map((u) => ({ id: u.id, name: u.name })),
                ),
                photos: JSON.stringify(photoUris),
              },
            });
          }}
        >
          <Text className='text-primary-foreground font-bold text-base'>
            Create Room
          </Text>
        </Pressable>
      </View>

      <AddParticipantSheet
        visible={showAddOptions}
        onClose={() => setShowAddOptions(false)}
        onShareSMS={handleShareSMS}
        onShowQR={handleShowQR}
        onAddManually={handleAddManually}
      />

      <AddParticipantManualModal
        visible={showAddUser}
        onClose={() => setShowAddUser(false)}
        onAdd={addUser}
        addedParticipants={users}
      />

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
                    className='text-accent-dark'
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

      {/* QR Code Modal */}
      <Modal
        transparent={false}
        animationType='slide'
        visible={showQRModal}
        onRequestClose={() => {
          setShowQRModal(false);
          setShowAddOptions(true);
        }}
      >
        <SafeAreaView className='flex-1 bg-background'>
          <View className='flex-1 items-center justify-center gap-8 px-6'>
            <Text className='text-foreground text-2xl font-bold'>
              Room QR Code
            </Text>
            <QRCode
              ref={qrRef}
              value={qrData}
              size={220}
              backgroundColor='white'
              color='black'
              getRef={(c) => (qrRef.current = c)}
            />
            <Text className='text-muted-foreground text-sm'>
              Room ID: {roomId}
            </Text>
          </View>
          <View className='px-5 pb-8'>
            <Pressable
              className='py-3 items-center active:opacity-70'
              onPress={() => {
                setShowQRModal(false);
                setShowAddOptions(true);
              }}
            >
              <Text className='text-accent-dark text-base font-medium'>
                Close
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
