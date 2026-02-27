import { USER_COLORS } from '@shared/constants';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';

export function UserTag({
  id,
  onRemove,
  isNewlyAdded,
}: {
  id: number;
  onRemove: () => void;
  isNewlyAdded: boolean;
}) {
  const DOUBLE_TAP_DELAY = 1000; // ms
  const [enableRemoveButton, setEnableRemoveButton] = useState(false);
  // FIXME: I'm pretty sure NodeJS is not available in react native
  // also, set timeout without a hook would lead to a memory leak
  let buttonIntervalId: ReturnType<typeof setTimeout> | null = null;

  const handlePress = () => {
    if (buttonIntervalId) clearTimeout(buttonIntervalId);
    buttonIntervalId = setTimeout(() => {
      setEnableRemoveButton(false);
    }, DOUBLE_TAP_DELAY);

    if (enableRemoveButton) {
      onRemove();
      return;
    }
    setEnableRemoveButton(true);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[isNewlyAdded && { transform: [{ scale: 1.1 }] }]}
      className={`bg-${USER_COLORS[(id - 1) % USER_COLORS.length]} w-10 h-10 rounded-lg justify-center items-center shadow-sm`}
      accessibilityLabel={`Double-tap to remove from user ${id}`}
    >
      {enableRemoveButton ? (
        <Text className='text-foreground text-base font-bold'>✕</Text>
      ) : (
        <Text className='text-foreground text-sm font-bold'>{id}</Text>
      )}
    </Pressable>
  );
}
