import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from "react-native";

export default function ReceiptRoomScreen() {
  return (
       <View 
       style={styles.container}>
        <Button 
        title="QR" 
        onPress={() => router.push('../QR_Page')} 
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
