import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, ReceiptPhotoPicker } from '@eezy-receipt/shared';
import { useGroupCache } from '@/providers';
import { createGroup } from '@/services/groupApi';

export default function CreateRoomScreen() {
  const { myGroups } = useGroupCache();

  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const userEditedNameRef = useRef(false);
  const getDefaultName = (_count: number) => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const time = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${date}, ${time}`;
  };
  const [editingGroupName, setEditingGroupName] = useState(false);

  useEffect(() => {
    if (userEditedNameRef.current || myGroups === null) return;
    setGroupName(getDefaultName(myGroups.length + 1));
  }, [myGroups]);

  const [isCreating, setIsCreating] = useState(false);

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
            setIsCreating(true);
            try {
              const { groupId } = await createGroup(
                groupName.trim() || 'New Room',
              );
              router.dismissAll();
              router.navigate({
                pathname: '/receipt-room',
                params: {
                  roomId: groupId,
                  participants: '[]',
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
    </SafeAreaView>
  );
}
