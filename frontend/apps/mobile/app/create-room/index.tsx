import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  AddParticipantManualModal,
} from '@eezy-receipt/shared';
import { USER_COLORS } from '@shared/constants';
import { useAuth, useGroupCache } from '@/providers';
import { createGroup } from '@/services/groupApi';

interface User {
  id: number;
  name: string;
  source: 'manual' | 'link' | 'qr';
}

export default function CreateRoomScreen() {
  const { user } = useAuth();
  const { myGroups } = useGroupCache();
  const hostName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'You (Host)';

  const [users, setUsers] = useState<User[]>(() => [
    { id: 1, name: hostName, source: 'link' },
  ]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const userEditedNameRef = useRef(false);
  const getDefaultName = (count: number) => {
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `Trip #${count}: ${date}`;
  };
  const [editingGroupName, setEditingGroupName] = useState(false);

  useEffect(() => {
    if (userEditedNameRef.current || myGroups === null) return;
    setGroupName(getDefaultName(myGroups.length + 1));
  }, [myGroups]);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // roomId is null until the backend creates the group
  const [roomId, setRoomId] = useState<string | null>(null);

  const addUser = (name: string) => {
    setUsers((prev) => [
      ...prev,
      { id: prev.length + 1, name, source: 'manual' },
    ]);
  };

  const handleAddManually = () => {
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
    if (user.source !== 'manual') return;
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
      {/* Back button + room name */}
      <View className='flex-row items-center px-5 pt-2 gap-3'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
        <View className='flex-1'>
          {editingGroupName ? (
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              returnKeyType='done'
              onSubmitEditing={() => {
                if (!groupName.trim()) {
                  setGroupName(getDefaultName((myGroups?.length ?? 0) + 1));
                } else {
                  userEditedNameRef.current = true;
                }
                setEditingGroupName(false);
              }}
              onBlur={() => {
                if (!groupName.trim()) {
                  setGroupName(getDefaultName((myGroups?.length ?? 0) + 1));
                } else {
                  userEditedNameRef.current = true;
                }
                setEditingGroupName(false);
              }}
              className='text-foreground text-xl font-bold border-b border-border py-1'
            />
          ) : (
            <Pressable
              onPress={() => setEditingGroupName(true)}
              className='flex-row items-center gap-2'
              accessibilityLabel='Edit group name'
            >
              <Text
                className='text-foreground text-xl font-bold'
                numberOfLines={1}
              >
                {groupName}
              </Text>
              <MaterialCommunityIcons
                name='pencil-outline'
                size={18}
                className='text-muted-foreground'
              />
            </Pressable>
          )}
        </View>
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
          contentContainerStyle={{
            gap: 10,
            paddingVertical: 4,
            flexGrow: 1,
            justifyContent: 'center',
          }}
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
                  numberOfLines={2}
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
            onPress={handleAddManually}
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
          className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
            isCreating
              ? 'bg-primary opacity-70'
              : 'bg-primary active:opacity-80'
          }`}
          disabled={isCreating}
          onPress={async () => {
            if (photoUris.length === 0) {
              Alert.alert(
                'No Receipt Photo',
                'Please add at least one receipt photo before creating a room.',
              );
              return;
            }
            setIsCreating(true);
            try {
              const { groupId } = await createGroup(
                groupName.trim() || 'New Room',
              );
              setRoomId(groupId);
              router.dismissAll();
              router.navigate({
                pathname: '/receipt-room',
                params: {
                  roomId: groupId,
                  participants: JSON.stringify(
                    users.map((u) => ({ id: u.id, name: u.name })),
                  ),
                  photos: JSON.stringify(photoUris),
                },
              });
            } catch (err) {
              Alert.alert(
                'Failed to Create Room',
                err instanceof Error
                  ? err.message
                  : 'Unknown error. Check your connection and try again.',
              );
            } finally {
              setIsCreating(false);
            }
          }}
        >
          {isCreating && <ActivityIndicator size='small' color='#ffffff' />}
          <Text className='text-primary-foreground font-bold text-base'>
            {isCreating ? 'Creating…' : 'Create Room'}
          </Text>
        </Pressable>
      </View>

      <AddParticipantManualModal
        visible={showAddUser}
        onClose={() => setShowAddUser(false)}
        onAdd={addUser}
        addedParticipants={users}
        lockedParticipantIds={users
          .filter((u) => u.source !== 'manual')
          .map((u) => u.id)}
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
    </SafeAreaView>
  );
}
