import { useTheme } from '@react-navigation/core';
import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  LayoutRectangle,
  useColorScheme,
  Pressable,
  TouchableOpacity,
} from 'react-native';

interface ParticipantsProps {
  id: number;
  color: string;
  changeName: (text: string) => void;
  onRemove: () => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
  onClickTextIn: () => void;
  onClickTextOut: () => void;
}

export default function Participant({
  id,
  color,
  changeName,
  onRemove,
  onLayout,
  goToYourItemsPage,
  onClickTextIn,
  onClickTextOut,
}: ParticipantsProps) {
  const ref = useRef<View>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onLayout({ x, y, width, height });
        });
      }}
      style={[styles.box, { backgroundColor: color }]}
      onPress={goToYourItemsPage}
    >
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, right: 10, left: 10 }}
      >
        <Text style={styles.deleteText}>x</Text>
      </TouchableOpacity>
      <TextInput
        placeholder={'Name ' + id}
        placeholderTextColor='#ffffff83'
        onChangeText={changeName}
        style={[styles.text]}
        onFocus={onClickTextIn}
        onBlur={onClickTextOut}
      ></TextInput>
    </Pressable>
  );
}

interface NativeThemeColorType {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}

const createStyles = (colors: NativeThemeColorType) =>
  StyleSheet.create({
    box: {
      padding: 20,
      borderWidth: 1,
      borderRadius: 10,
      height: 100,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderColor: colors.border,
      position: 'relative',
    },
    text: {
      top: -5,
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    deleteButton: {
      position: 'absolute',
      top: -7,
      left: -7,
      backgroundColor: '#FF3B30',
      width: 24,
      height: 24,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      zIndex: 10,
    },
    deleteText: {
      color: 'white',
      fontSize: 17,
      fontWeight: 'bold',
      top: -2,
    },
  });
