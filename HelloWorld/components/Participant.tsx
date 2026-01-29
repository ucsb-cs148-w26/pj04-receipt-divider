import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutRectangle,
  useColorScheme,
} from 'react-native';

interface ParticipantsProps {
  id: number;
  onLayout: (event: LayoutRectangle) => void;
}

export default function Participant({ id, onLayout }: ParticipantsProps) {
  const ref = useRef<View>(null);

  const theme = useColorScheme();
  const isDark = theme === 'dark';

  return (
    <View
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onLayout({ x, y, width, height });
        });
      }}
      style={[styles.box, isDark && styles.boxDark]}
    >
      <Text style={[styles.text, isDark && styles.textDark]}>
        Participant {id}
      </Text>
    </View>
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
