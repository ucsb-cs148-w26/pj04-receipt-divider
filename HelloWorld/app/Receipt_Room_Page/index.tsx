import { useTheme } from '@react-navigation/native';
import { ReceiptItem, ReceiptItemType } from '@/components/Item';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Button,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Participant from '../../components/Participant';

interface NativeThemeColorType {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}

export default function ReceiptRoomScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams();

  const [participants, setParticipants] = useState<number[]>([]);

  const addParticipant = () => {
    const newID = participants.length + 1;
    setParticipants([...participants, newID]);
  };

  /**---------------- QR Code ---------------- */
  const [roomId] = useState(() => {
    // Check if room ID was passed in URL (i.e. from QR code scan to join a receipt room)
    if (params.roomId && typeof params.roomId === 'string') {
      return params.roomId;
    }
    // Otherwise create new room ID for this receipt session
    return Math.random().toString(36).substring(2, 9);
  });

  /**---------------- Receipt Items ---------------- */
  // Lift state up from AppScreen so it persists across navigation
  const [receiptItems, setReceiptItems] = useState<ReceiptItemType[]>([
    { id: '1', name: 'Burger', price: '12.99', userTags: [] },
  ]);

  const addReceiptItem = () => {
    const newItem: ReceiptItemType = {
      id: Date.now().toString(),
      name: '',
      price: '',
      userTags: [],
    };
    // Insert before tax item
    const taxIndex = receiptItems.findIndex((item) => item.id === 'tax');
    if (taxIndex !== -1) {
      const newItems = [...receiptItems];
      newItems.splice(taxIndex, 0, newItem);
      setReceiptItems(newItems);
    } else {
      setReceiptItems([...receiptItems, newItem]);
    }
  };

  const updateReceiptItem = (id: string, updates: Partial<ReceiptItemType>) => {
    setReceiptItems(
      receiptItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  };

  const deleteReceiptItem = (id: string) => {
    setReceiptItems(receiptItems.filter((item) => item.id !== id));
  };

  const removeItemFromUser = (itemId: string, userIndex: number) => {
    setReceiptItems(
      receiptItems.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            userTags: item.userTags?.filter((tag) => tag !== userIndex),
          };
        }
        return item;
      }),
    );
  };
  //const taxItem = receiptItems.find(item => item.id === 'tax');
  const regularItems = receiptItems.filter((item) => item.id !== 'tax');

  return (
    <View style={styles.container}>
      {/* Middle part - scrollable receipt items */}
      <ScrollView
        style={styles.itemsContainer}
        contentContainerStyle={styles.itemsContent}
      >
        <View style={styles.itemsList}>
          {regularItems.map((item, index) => (
            <ReceiptItem
              key={item.id}
              item={item}
              index={index}
              onUpdate={(updates) => updateReceiptItem(item.id, updates)}
              onDelete={() => deleteReceiptItem(item.id)}
              onRemoveFromUser={(userIndex) =>
                removeItemFromUser(item.id, userIndex)
              }
            />
          ))}

          <TouchableOpacity
            onPress={addReceiptItem}
            style={styles.addItemButton}
            accessibilityLabel='Add receipt item'
          >
            <Text style={styles.addItemButtonText}>➕ Add Receipt Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ScrollView
        horizontal={true}
        contentContainerStyle={styles.participantsScrollContent}
      >
        {participants.map((id) => (
          <Participant key={id} id={id} />
        ))}
      </ScrollView>

      <Button title='Add Participant' onPress={addParticipant} />

      <Button
        title='QR'
        onPress={() => router.push(`/QR_Page?roomId=${roomId}`)}
      />
      <Button
        title='Settings'
        onPress={() => router.push('../Settings_Page')}
      />
      <Button
        title='Your Items'
        onPress={() => router.push('../Your_Items_Page')}
      />
      <Button title='Close Room' onPress={() => router.push('../Home_Page')} />
    </View>
  );
}

const createStyles = (colors: NativeThemeColorType) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 60,
    },
    topBar: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topBarButton: {
      padding: 8,
      borderRadius: 8,
    },
    topBarButtonText: {
      fontSize: 24,
      color: colors.text,
    },
    itemsContainer: {
      flex: 1,
      padding: 16,
    },
    itemsContent: {
      maxWidth: 800,
      alignSelf: 'center',
    },
    itemsList: {
      gap: 8,
    },
    addItemButton: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    addItemButtonText: {
      color: colors.text,
      fontSize: 16,
    },
    usersContainer: {
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 16,
    },
    usersContent: {
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addUserButton: {
      width: 128,
      height: 128,
      borderRadius: 8,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addUserButtonText: {
      fontSize: 32,
      color: colors.text,
    },
    participantsScrollContent: {
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 10,
    },
  });
