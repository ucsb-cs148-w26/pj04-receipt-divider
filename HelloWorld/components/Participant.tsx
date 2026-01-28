import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ParticipantsProps {
  id: number;
}

export default function Participant({ id }: ParticipantsProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Participant {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
  },
  text: {},
});
