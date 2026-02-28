import { USER_COLORS } from '@shared/constants';
import React, { useState, useEffect, useRef } from 'react';
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
  const buttonIntervalId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    if (buttonIntervalId.current) clearTimeout(buttonIntervalId.current);
    buttonIntervalId.current = setTimeout(() => {
      setEnableRemoveButton(false);
    }, DOUBLE_TAP_DELAY);

    if (enableRemoveButton) {
      onRemove();
      return;
    }
    setEnableRemoveButton(true);
  };

  useEffect(() => {
    return () => {
      if (buttonIntervalId.current) clearTimeout(buttonIntervalId.current);
    };
  }, []);

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
