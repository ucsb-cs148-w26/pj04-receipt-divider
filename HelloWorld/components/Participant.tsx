import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';

interface ParticipantsProps {
  id: number;
}

export default function Participant({ id }: ParticipantsProps) {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  return (
    <View style={[styles.box, isDark && styles.boxDark]}>
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
