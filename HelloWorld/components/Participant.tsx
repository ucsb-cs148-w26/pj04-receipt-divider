import React, { useRef } from 'react';
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
  name: string;
  color: string;
  changeName: (text: string) => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
}

export default function Participant({ id, name, color, changeName, onLayout, goToYourItemsPage }: ParticipantsProps) {
  const ref = useRef<View>(null);

  const theme = useColorScheme();
  const isDark = theme === 'dark';

  return (
    <Pressable
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onLayout({ x, y, width, height });
        });
      }}
      style={[styles.box, isDark && styles.boxDark, {backgroundColor: color}]}
      onPress={goToYourItemsPage}
    >
      <TextInput
        value = {name}
        onChangeText = {changeName}
        style={[styles.text, isDark && styles.textDark]}
        >
      </TextInput>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    borderColor: '#B0B0B0',
  },
  text: {
    color: '#000000',
  },
  boxDark: {
    backgroundColor: '#333333',
    borderColor: '#555555',
  },
  textDark: {
    color: '#FFFFFF',
  },
});
