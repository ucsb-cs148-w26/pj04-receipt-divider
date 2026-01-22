import { router } from 'expo-router';
import React from 'react';
import { Button, StyleSheet, View } from "react-native";

export default function YourItemsScreen() {
  return (
       <View 
       style={styles.container}>
        <Button 
        title="Close" 
        onPress={() => router.push('../Receipt_Room_Page')} 
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
