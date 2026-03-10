import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DefaultButtons } from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers';
import { supabase } from '@/services/supabase';

const ACCENT_COLORS = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#8B5CF6', // violet
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
];

// ── Reusable row (top-level to avoid re-mount on parent re-render) ──
function SettingRow({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className='flex-row items-center px-4 py-4 active:opacity-70'
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={destructive ? '#EF4444' : '#9CA3AF'}
      />
      <View className='flex-1 ml-3'>
        <Text
          className={`text-base font-medium ${destructive ? 'text-red-500' : 'text-foreground'}`}
        >
          {label}
        </Text>
        {value ? (
          <Text className='text-sm text-muted-foreground' numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name='chevron-right' size={20} color='#6B7280' />
    </Pressable>
  );
}

// ── Edit modal shell (top-level to avoid re-mount on parent re-render) ──
function EditModal({
  visible,
  title,
  onClose,
  onSave,
  saving,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType='fade'>
      <Pressable
        className='flex-1 bg-black/50 justify-center items-center'
        onPress={onClose}
      >
        <Pressable
          className='bg-card w-[85%] rounded-2xl p-5'
          onPress={() => {}}
        >
          <Text className='text-foreground text-lg font-bold mb-4'>
            {title}
          </Text>
          {children}
          <View className='flex-row justify-end gap-3 mt-5'>
            <Pressable onPress={onClose} className='px-4 py-2 rounded-lg'>
              <Text className='text-muted-foreground font-medium'>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={saving}
              className='bg-primary px-5 py-2 rounded-lg'
            >
              <Text className='text-white font-medium'>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { signOut, user } = useAuth();

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const email = user?.email ?? '';

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);

  const [newName, setNewName] = useState(fullName);
  const [newEmail, setNewEmail] = useState(email);
  const [selectedColor, setSelectedColor] = useState(ACCENT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const displayInitial = (fullName || email || 'U')[0]?.toUpperCase();

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: newName.trim() },
      });
      if (error) throw error;
      Alert.alert('Success', 'Name updated.');
      setNameModalVisible(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) throw error;
      Alert.alert(
        'Confirmation Sent',
        'Check your new email to confirm the change.',
      );
      setEmailModalVisible(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveColor = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { accent_color: selectedColor },
      });
      if (error) throw error;
      Alert.alert('Success', 'Accent color updated.');
      setColorModalVisible(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      <DefaultButtons.Close onPress={() => router.back()} />

      {/* Profile picture + name */}
      <View className='items-center mt-[10vh] mb-6'>
        <View className='w-24 h-24 rounded-full overflow-hidden mb-3 shadow-md shadow-black/20'>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className='w-full h-full' />
          ) : (
            <View className='w-full h-full items-center justify-center bg-primary'>
              <Text className='text-white font-bold text-3xl'>
                {displayInitial}
              </Text>
            </View>
          )}
        </View>
        <Text className='text-foreground text-xl font-bold'>
          {fullName || 'User'}
        </Text>
        <Text className='text-muted-foreground text-sm'>{email}</Text>
      </View>

      {/* Settings options */}
      <View className='bg-card mx-5 rounded-2xl overflow-hidden'>
        <SettingRow
          icon='account-outline'
          label='Name'
          value={fullName || 'Not set'}
          onPress={() => {
            setNewName(fullName);
            setNameModalVisible(true);
          }}
        />
        <View className='h-px bg-border mx-4' />
        <SettingRow
          icon='email-outline'
          label='Email'
          value={email}
          onPress={() => {
            setNewEmail(email);
            setEmailModalVisible(true);
          }}
        />
        <View className='h-px bg-border mx-4' />
        <SettingRow
          icon='palette-outline'
          label='Accent Color'
          onPress={() => setColorModalVisible(true)}
        />
      </View>

      {/* Sign out */}
      <View className='bg-card mx-5 mt-4 rounded-2xl overflow-hidden'>
        <SettingRow
          icon='logout'
          label='Sign Out'
          onPress={handleSignOut}
          destructive
        />
      </View>

      {/* Name modal */}
      <EditModal
        visible={nameModalVisible}
        title='Change Name'
        onClose={() => setNameModalVisible(false)}
        onSave={handleSaveName}
        saving={saving}
      >
        <TextInput
          className='bg-background text-foreground px-4 py-3 rounded-lg text-base'
          placeholder='Enter your name'
          placeholderTextColor='#9CA3AF'
          value={newName}
          onChangeText={setNewName}
          autoFocus
        />
      </EditModal>

      {/* Email modal */}
      <EditModal
        visible={emailModalVisible}
        title='Change Email'
        onClose={() => setEmailModalVisible(false)}
        onSave={handleSaveEmail}
        saving={saving}
      >
        <TextInput
          className='bg-background text-foreground px-4 py-3 rounded-lg text-base'
          placeholder='Enter new email'
          placeholderTextColor='#9CA3AF'
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType='email-address'
          autoCapitalize='none'
          autoFocus
        />
      </EditModal>

      {/* Color modal */}
      <EditModal
        visible={colorModalVisible}
        title='Choose Accent Color'
        onClose={() => setColorModalVisible(false)}
        onSave={handleSaveColor}
        saving={saving}
      >
        <View className='flex-row flex-wrap gap-3 justify-center'>
          {ACCENT_COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => setSelectedColor(color)}
              className='items-center justify-center'
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: color,
                borderWidth: selectedColor === color ? 3 : 0,
                borderColor: '#FFFFFF',
              }}
            >
              {selectedColor === color && (
                <MaterialCommunityIcons
                  name='check'
                  size={22}
                  color='#FFFFFF'
                />
              )}
            </Pressable>
          ))}
        </View>
      </EditModal>
    </SafeAreaView>
  );
}
