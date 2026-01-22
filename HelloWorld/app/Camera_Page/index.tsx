import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from "react-native";

export default function CameraScreen() {
  return (
       <View 
       style={styles.container}>
        <Button 
        title="Next" 
        onPress={() => router.push('../Receipt_Room_Page')} 
        />
        <Button
        title="Cancle"
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
