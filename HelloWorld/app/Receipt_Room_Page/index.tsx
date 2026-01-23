import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, View, Text } from "react-native";

export default function ReceiptRoomScreen() {
  const params = useLocalSearchParams();
  
  const [roomId] = useState(() => {
    // Check if room ID was passed in URL (i.e. from QR code scan to join a receipt room)
    if (params.roomId && typeof params.roomId === 'string') {
      return params.roomId;
    }
    // Otherwise create new room ID for this receipt session
    return Math.random().toString(36).substring(2, 9);
  });

  return (
       <View 
       style={styles.container}>
        <Button 
        title="QR" 
        onPress={() => router.push(`/QR_Page?roomId=${roomId}`)}
        />
        <Button 
        title="Settings" 
        onPress={() => router.push('../Settings_Page')}
        />
        <Button
        title="Your Items"
        onPress={() => router.push('../Your_Items_Page')}
        />
        <Button
        title="Close Room"
        onPress={() => router.push('../Home_Page')}
        />
        </View>
      );
    }

const styles = StyleSheet.create(
    {
        container: {
            flex: 1,
            justifyContent: 'center', 
            alignItems: 'center',
        },
    }
);
