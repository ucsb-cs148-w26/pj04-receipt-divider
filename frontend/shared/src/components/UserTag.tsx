import { useTheme } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

// FIXME: refactor to tailwind
interface NativeThemeColorType {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}

export default function UserTag({
  userIndex,
  color,
  onRemove,
  isNewlyAdded,
}: {
  userIndex: number;
  color: string;
  onRemove: () => void;
  isNewlyAdded: boolean;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => createStyles(colors, dark), [colors, dark]);
  const DOUBLE_TAP_DELAY = 1000; // ms
  const [enableRemoveButton, setEnableRemoveButton] = useState(false);
  // FIXME: I'm pretty sure NodeJS is not avalible in react native
  // also, set timeout wihout a hook would lead to a memory leak
  let buttonIntervalId: NodeJS.Timeout | null = null;

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
      style={[
        styles.userTag,
        { backgroundColor: color },
        isNewlyAdded && styles.userTagNew,
      ]}
      accessibilityLabel={`Double-tap to remove from user ${userIndex}`}
    >
      {enableRemoveButton ? (
        <Text style={styles.userTagRemove}>✕</Text>
      ) : (
        <Text style={styles.userTagText}>{userIndex}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (colors: NativeThemeColorType, dark: boolean) =>
  StyleSheet.create({
    userTag: {
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    userTagNew: {
      transform: [{ scale: 1.1 }],
    },
    userTagRemove: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    userTagText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
  });
