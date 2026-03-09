import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { USER_COLORS } from '../constants';

// ── Options bottom sheet ───────────────────────────────────────────────────────

export type AddParticipantSheetProps = {
  visible: boolean;
  onClose: () => void;
  onShareSMS: () => void;
  onShowQR: () => void;
  onAddManually: () => void;
};

export function AddParticipantSheet({
  visible,
  onClose,
  onShareSMS,
  onShowQR,
  onAddManually,
}: AddParticipantSheetProps) {
  return (
    <Modal
      transparent
      animationType='fade'
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className='flex-1 bg-black/50 justify-end' onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View className='bg-card rounded-t-2xl p-6'>
            <Text className='text-foreground text-xl font-bold mb-4'>
              Add Participant
            </Text>
            <Pressable
              className='flex-row items-center gap-4 py-3 active:opacity-70'
              onPress={onShareSMS}
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
              onPress={onShowQR}
            >
              <MaterialCommunityIcons name='qrcode' size={24} color='#4999DF' />
              <Text className='text-foreground text-base'>
                Show Room QR Code
              </Text>
            </Pressable>
            <View className='h-px bg-border my-1' />
            <Pressable
              className='flex-row items-center gap-4 py-3 active:opacity-70'
              onPress={onAddManually}
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
              onPress={onClose}
            >
              <Text className='text-accent-dark text-base font-medium'>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Manual add modal ───────────────────────────────────────────────────────────

export type AddParticipantManualModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called when the user confirms adding a participant. */
  // eslint-disable-next-line no-unused-vars
  onAdd: (_name: string) => void;
  /** Optional list of already-added participants to display as tags. */
  addedParticipants?: { id: number; name: string }[];
};

export function AddParticipantManualModal({
  visible,
  onClose,
  onAdd,
  addedParticipants,
}: AddParticipantManualModalProps) {
  const [value, setValue] = useState('');

  // Clear input each time the modal opens
  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  const handleAdd = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue(''); // clear input, keep modal open
  };

  return (
    <Modal
      transparent
      animationType='fade'
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable className='flex-1 bg-black/50 justify-center items-center px-6'>
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-2xl p-6 w-80'>
              <Text className='text-foreground text-xl font-bold mb-4'>
                Add Participant
              </Text>

              <TextInput
                placeholder='Name'
                placeholderTextColor='var(--color-muted-foreground)'
                value={value}
                onChangeText={setValue}
                onSubmitEditing={handleAdd}
                returnKeyType='done'
                className='border border-border rounded-xl px-4 py-3 text-foreground mb-4'
                autoFocus
              />

              {addedParticipants && addedParticipants.length > 0 && (
                <View className='flex-row flex-wrap gap-2 mb-4'>
                  {addedParticipants.map((p) => (
                    <View
                      key={p.id}
                      className={`px-3 py-1 rounded-full border-2 border-${USER_COLORS[(p.id - 1) % USER_COLORS.length]}`}
                    >
                      <Text className='text-foreground text-sm'>{p.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                className='bg-primary rounded-xl py-3 items-center active:opacity-80 mb-2'
                onPress={handleAdd}
              >
                <Text className='text-primary-foreground font-bold'>Add</Text>
              </Pressable>

              <Pressable
                className='bg-card border border-border rounded-xl py-3 items-center active:opacity-70'
                onPress={onClose}
              >
                <Text className='text-foreground font-medium'>Complete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
