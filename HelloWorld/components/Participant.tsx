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
} from 'react-native';

interface ParticipantsProps {
  id: number;
  color: string;
  changeName: (text: string) => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
  onClickTextIn: () => void;
  onClickTextOut: () => void;
}

export default function Participant({
  id,
  color,
  changeName,
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
    },
    text: {
      top: -15,
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
  });
