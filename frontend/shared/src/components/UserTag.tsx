import { USER_COLORS } from '@shared/constants';
import React from 'react';
import { Pressable, Text } from 'react-native';

export function UserTag({
  id,
  onRemove,
  isNewlyAdded,
  isEditMode = true,
}: {
  id: number;
  onRemove: () => void;
  isNewlyAdded: boolean;
  isEditMode?: boolean;
}) {
  return (
    <Pressable
      onPress={isEditMode ? onRemove : undefined}
      style={[isNewlyAdded && { transform: [{ scale: 1.1 }] }]}
      className={`bg-${USER_COLORS[(id - 1) % USER_COLORS.length]} px-2.5 py-1 rounded-md justify-center items-center shadow-sm`}
      accessibilityLabel={
        isEditMode ? `Tap to remove user ${id}` : `Claimed by user ${id}`
      }
    >
      {isEditMode ? (
        <Text className='text-white text-sm font-bold'>✕</Text>
      ) : (
        <Text className='text-white text-sm font-bold'>{id}</Text>
      )}
    </Pressable>
  );
}
