import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from "react-native";

export default function HomeScreen() {
  return (
       <View 
       style={styles.container}>
        <Button 
        title="Back"      
        onPress={() => router.back()}
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
