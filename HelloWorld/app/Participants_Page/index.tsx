import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, View, ScrollView } from "react-native";
import Participant from '../../components/Participant';

export default function ParticipantsScreen() {
    const [participants, setParticipants] = useState<number[]>([]);

    const addParticipant = () => {
        const newID = participants.length + 1;
        setParticipants([...participants, newID]);
    };

  return (
       <View style = {styles.container}>
           <ScrollView
           horizontal = {true}
           contentContainerStyle = {styles.scrollContent}>
                {participants.map((id) => (
                    <Participant key = {id} id = {id} />
                ))}
            </ScrollView>

            <View style = {styles.buttons}>
                <Button 
                    title="Add Participant"      
                    onPress = {addParticipant}
                /> 

                <Button 
                    title="Back"      
                    onPress={() => router.back()}
                />  
            </View>
        </View>
      );
    }

const styles = StyleSheet.create(
    {
        container: {
            flex: 1,
            alignItems: 'center',
        },
        scrollContent: {
            alignItems: 'center',
            paddingHorizontal: 20,
            gap: 10,
        },
        buttons: {
            bottom: 100,
        }
    }
);