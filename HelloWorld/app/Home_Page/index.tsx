import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from "react-native";

export default function HomeScreen() {
  return (
       <View 
       style={styles.container}>
        <Button 
        title="Take Photo" 
        onPress={() => router.push('../Camera_Page')} 
        />
        <Button
        title="Settings"
        onPress={() => router.push('../Settings_Page')}
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
