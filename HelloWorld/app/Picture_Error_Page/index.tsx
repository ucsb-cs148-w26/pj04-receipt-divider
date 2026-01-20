import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from "react-native";

export default function HomeScreen() {
  return (
       <View 
       style={styles.container}>
        <Button 
        title="Back to Home Page" 
        onPress={() => router.push('../Home_Page')} 
        />
        <Button 
        title="Back to Camera" 
        onPress={() => router.push('../Camera_Page')} 
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
