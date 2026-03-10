import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  onShareQR?: () => void;
  onAddManually: () => void;
};

export function AddParticipantSheet({
  visible,
  onClose,
  onShareSMS,
  onShareQR,
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
            {onShareQR && (
              <>
                <View className='h-px bg-border my-1' />
                <Pressable
                  className='flex-row items-center gap-4 py-3 active:opacity-70'
                  onPress={onShareQR}
                >
                  <MaterialCommunityIcons
                    name='qrcode'
                    size={24}
                    color='#4999DF'
                  />
                  <Text className='text-foreground text-base'>
                    Share via QR Code
                  </Text>
                </Pressable>
              </>
            )}
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
              <Text className='text-foreground text-base'>
                Add Manually (Guest)
              </Text>
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
  /** Participant ids whose names cannot be edited (e.g. they have a real account). */
  lockedParticipantIds?: number[];
  /** Called when a participant tag is renamed. */
  // eslint-disable-next-line no-unused-vars
  onRenameParticipant?: (_id: number, _newName: string) => void;
  /** Called when a participant tag is deleted. */
  // eslint-disable-next-line no-unused-vars
  onRemoveParticipant?: (_id: number) => void;
  /** Names of participants currently being added (shows a loading spinner instead of the name). */
  loadingParticipantNames?: string[];
};

export function AddParticipantManualModal({
  visible,
  onClose,
  onAdd,
  addedParticipants,
  lockedParticipantIds,
  onRenameParticipant,
  onRemoveParticipant,
  loadingParticipantNames,
}: AddParticipantManualModalProps) {
  const [value, setValue] = useState('');
  const valueRef = useRef(value);

  const handleValueChange = (text: string) => {
    valueRef.current = text;
    setValue(text);
  };

  // Clear input each time the modal opens
  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  const handleAdd = () => {
    const name = valueRef.current.trim();
    if (!name) return;
    if ((addedParticipants?.length ?? 0) >= 10) {
      Alert.alert('Maximum Reached', 'You can only add up to 10 participants.');
      return;
    }
    onAdd(name);
    valueRef.current = '';
    setValue('');
  };

  const handleSubmitEditing = () => {
    handleAdd();
  };

  const handleParticipantPress = (p: { id: number; name: string }) => {
    if (lockedParticipantIds?.includes(p.id)) {
      Alert.alert(
        p.name,
        'This participant has a linked account and cannot be renamed or removed.',
        [{ text: 'OK', style: 'cancel' }],
      );
      return;
    }
    Alert.alert(p.name, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          Alert.prompt(
            'Rename Participant',
            undefined,
            (newName) => {
              if (newName?.trim()) onRenameParticipant?.(p.id, newName.trim());
            },
            'plain-text',
            p.name,
          );
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onRemoveParticipant?.(p.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Modal
      transparent
      animationType='fade'
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className='flex-1 bg-black/50 justify-end items-center px-6'
        style={{ paddingBottom: 340 }}
      >
        <Pressable onPress={() => {}}>
          <View className='bg-card rounded-2xl p-6 w-80'>
            <Text className='text-foreground text-xl font-bold mb-4'>
              Add Participant
            </Text>

            <TextInput
              placeholder='Name'
              placeholderTextColor='var(--color-muted-foreground)'
              value={value}
              onChangeText={handleValueChange}
              onSubmitEditing={handleSubmitEditing}
              returnKeyType='done'
              autoCorrect={false}
              className='border border-border rounded-xl px-4 py-3 text-foreground mb-4'
              autoFocus
            />

            {((addedParticipants && addedParticipants.length > 0) ||
              (loadingParticipantNames &&
                loadingParticipantNames.length > 0)) && (
              <View className='flex-row flex-wrap items-center justify-center gap-2 mb-4'>
                {(addedParticipants ?? []).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => handleParticipantPress(p)}
                    className={`px-3 py-1 rounded-full border-2 border-${USER_COLORS[(p.id - 1) % USER_COLORS.length]} active:opacity-60`}
                  >
                    <Text className='text-foreground text-sm'>{p.name}</Text>
                  </Pressable>
                ))}
                {(loadingParticipantNames ?? []).map((name) => (
                  <View
                    key={`loading-${name}`}
                    className='flex-row items-center gap-1.5 px-3 py-1 rounded-full border-2 border-border opacity-60'
                  >
                    <ActivityIndicator size='small' color='#4999DF' />
                    <Text className='text-muted-foreground text-sm'>
                      {name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              className={`rounded-xl py-3 items-center mb-2 ${
                value.trim()
                  ? 'bg-card border border-border active:opacity-80'
                  : 'bg-card border border-border opacity-40'
              }`}
              onPress={handleSubmitEditing}
              disabled={!value.trim()}
            >
              <Text className='text-foreground font-bold'>Add</Text>
            </Pressable>

            <Pressable
              className='bg-primary rounded-xl py-3 items-center active:opacity-70'
              onPress={onClose}
            >
              <Text className='text-primary-foreground font-medium'>
                Complete
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
