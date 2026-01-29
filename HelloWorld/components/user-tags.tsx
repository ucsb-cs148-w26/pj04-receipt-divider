import { useTheme } from '@react-navigation/native';
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

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
    isNewlyAdded
}: {
    userIndex: number;
    color: string;
    onRemove: () => void;
    isNewlyAdded: boolean;
}) {
    const { colors, dark } = useTheme();
    const styles = useMemo(() => createStyles(colors, dark), [colors, dark]);
    const [isHovering, setIsHovering] = useState(false);
    const lastTapRef = React.useRef<number>(0);
    const DOUBLE_TAP_DELAY = 300; // ms

    const handlePress = () => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double tap detected - remove the tag
            onRemove();
            lastTapRef.current = 0; // Reset
        } else {
            lastTapRef.current = now;
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            onHoverIn={() => setIsHovering(true)}
            onHoverOut={() => setIsHovering(false)}
            onPressIn={() => setIsHovering(true)}
            onPressOut={() => setIsHovering(false)}
            style={[styles.userTag, { backgroundColor: color }, isNewlyAdded && styles.userTagNew]}
            accessibilityLabel={`Double-tap to remove from user ${userIndex}`}
        >
            {isHovering ? (
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
