import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
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

interface User {
  id: number;
  name: string;
}

export default function CreateRoomScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');

  const addUser = () => {
    if (!newUserName.trim()) return;
    setUsers((prev) => [
      ...prev,
      { id: prev.length + 1, name: newUserName.trim() },
    ]);
    setNewUserName('');
    setShowAddUser(false);
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Back button */}
      <View className='px-5 pt-2'>
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20 w-10 h-10'
          iconClassName='text-[#8FA4CE]'
          pressEffect='fade'
          onPress={() => router.back()}
        />
      </View>

      {/* Receipt section — grows to fill space */}
      <View className='flex-1 px-5 mt-3'>
        <Text className='text-foreground text-2xl font-bold mb-3'>Receipt</Text>

        {/* Photo card — flex-1 so it fills available space */}
        <View className='bg-white rounded-2xl flex-1 relative'>
          <Pressable className='absolute top-4 right-4' hitSlop={8}>
            <MaterialCommunityIcons
              name='dots-horizontal'
              size={22}
              color='#8FA4CE'
            />
          </Pressable>
          <View className='flex-1 items-center justify-center'>
            <MaterialCommunityIcons
              name='image-outline'
              size={60}
              color='#6b7280'
            />
            <Text className='text-muted-foreground mt-3 text-base'>
              add or take photo
            </Text>
          </View>
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
            <View
              key={user.id}
              className='bg-white rounded-2xl overflow-hidden shadow-sm shadow-black/10'
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
                  <Text className='text-white text-sm font-bold'>{user.id}</Text>
                </View>
                <Text
                  className='text-foreground font-bold text-sm flex-1'
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                <Pressable
                  onPress={() =>
                    setUsers((prev) => prev.filter((u) => u.id !== user.id))
                  }
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name='close' size={14} color='#8FA4CE' />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            className='bg-white rounded-2xl overflow-hidden shadow-sm shadow-black/10 items-center justify-center active:opacity-70'
            style={{ width: 100, minHeight: 68 }}
            onPress={() => setShowAddUser(true)}
          >
            <MaterialCommunityIcons name='plus' size={28} color='#8FA4CE' />
          </Pressable>
        </ScrollView>
      </View>

      {/* Create Room button */}
      <View className='absolute bottom-10 left-5 right-5'>
        <Pressable
          className='bg-primary rounded-2xl py-4 items-center active:opacity-80'
          onPress={() => router.navigate('/receipt-room')}
        >
          <Text className='text-white font-bold text-base'>Create Room</Text>
        </Pressable>
      </View>

      {/* Add User Modal */}
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
            <View className='bg-white rounded-2xl p-6 w-80'>
              <View className='flex-row items-center justify-between mb-4'>
                <Text className='text-foreground text-xl font-bold'>
                  Add User
                </Text>
                <Pressable onPress={() => setShowAddUser(false)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name='close'
                    size={22}
                    color='#8FA4CE'
                  />
                </Pressable>
              </View>

              <TextInput
                placeholder='Name'
                placeholderTextColor='#9ca3af'
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
    </SafeAreaView>
  );
}
