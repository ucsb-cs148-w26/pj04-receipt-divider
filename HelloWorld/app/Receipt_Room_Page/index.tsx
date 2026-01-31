import { useTheme } from '@react-navigation/native';
import { ReceiptItem, ReceiptItemType } from '../../components/Item';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Button,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  LayoutRectangle,
  Animated,
} from 'react-native';
import Participant from '../../components/Participant';
import { useReceipt } from '../../contexts/ReceiptContext';

interface NativeThemeColorType {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}
export const ITEMCONTAINERPADDING = 16;

interface DragState {
  isDragging: boolean;
  itemId: number | null;
  initialPosition: { x: number; y: number } | null;
  isOverParticipant: boolean;
}

interface ParticipantType {
  id: number;
  name: string;
}

export type ReceiptRoomParams = {
  roomId: string;
  items: string;
};

export default function ReceiptRoomScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<ReceiptRoomParams>();

  /**---------------- Participants State ---------------- */
  const [participants, setParticipants] = useState<ParticipantType[]>([]);
  const participantLayouts = useRef<Record<number, LayoutRectangle>>({});
  const [scrollOffset, setScrollOffset] = useState(0);

  /**---------------- Drag State ---------------- */
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    itemId: null,
    initialPosition: null,
    isOverParticipant: false,
  });
  const dragPan = useRef(new Animated.ValueXY()).current;

  /**---------------- Text Focus State ---------------- */
  const [isAnyTextFocused, setIsAnyTextFocused] = useState(false);

  /**---------------- Participants Functions ---------------- */
  const addParticipant = () => {
    const newID = participants.length + 1;
    const newParticipant = {
      id: newID,
      name: `Participant ${newID}`
    }
    setParticipants([...participants, newParticipant]);
  };

  const changeParticipantName = (id: number, newName: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id ? {...p, name: newName} : p
      )
    );
  };

  /**---------------- Drag Functions ---------------- */
  const handleItemDragStart = (
    itemId: number,
    initialPosition?: { x: number; y: number },
  ) => {
    setDragState({
      isDragging: true,
      itemId,
      initialPosition: initialPosition || null,
      isOverParticipant: false,
    });
    dragPan.setValue({ x: 0, y: 0 });
    console.log('Started dragging item', itemId);
  };

  const handleItemDragEnd = () => {
    setDragState({
      isDragging: false,
      itemId: null,
      initialPosition: null,
      isOverParticipant: false,
    });
    Animated.spring(dragPan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const handleParticipantBoundsChange = (isOverParticipant: boolean) => {
    setDragState((prev) => ({ ...prev, isOverParticipant }));
  };

  /**---------------- QR Code State ---------------- */
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
  const [receiptItems, setReceiptItems] = useState<ReceiptItemType[]>(
    JSON.parse(params.items),
  );

  /**---------------- Receipt Items Functions ---------------- */
  const addReceiptItem = () => {
    const newItem: ReceiptItemType = {
      id: receiptItems.length + 1,
      name: '',
      price: '',
      userTags: [],
    };
    setReceiptItems([...receiptItems, newItem]);
    console.log('All receipt items:', receiptItems);
  };

  const updateReceiptItem = (id: number, updates: Partial<ReceiptItemType>) => {
    setReceiptItems((prevItems) => {
      const updatedItems = prevItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      );
      console.log('Updated receipt items:', updatedItems);
      return updatedItems;
    });
  };

  const deleteReceiptItem = (id: number) => {
    setReceiptItems(receiptItems.filter((item) => item.id !== id));
    console.log('Deleted receipt items:', receiptItems);
  };

  const removeItemFromUser = (itemId: number, userIndex: number) => {
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

  /**---------------- Render ---------------- */
  return (
    <View style={styles.container}>
      <View style={styles.scrollArea}>
        {/* Middle part - scrollable receipt items */}
        <ScrollView
          style={styles.itemsContainer}
          contentContainerStyle={styles.itemsContent}
          scrollEnabled={!dragState.isDragging}
        >
          <View style={styles.itemsList}>
            {receiptItems.map((item) => (
              <ReceiptItem
                key={item.id}
                item={item}
                onUpdate={(updates) => updateReceiptItem(item.id, updates)}
                onDelete={() => deleteReceiptItem(item.id)}
                onRemoveFromUser={(userIndex) =>
                  removeItemFromUser(item.id, userIndex)
                }
                participantLayouts={participantLayouts.current}
                scrollOffset={scrollOffset}
                onDragStart={(itemId, initialPosition) =>
                  handleItemDragStart(item.id, initialPosition)
                }
                onDragEnd={handleItemDragEnd}
                isDragging={dragState.itemId === item.id}
                dragPan={dragState.itemId === item.id ? dragPan : undefined}
                onParticipantBoundsChange={handleParticipantBoundsChange}
                isInParticipantBoundsProp={false}
                getCurrentItemData={() =>
                  receiptItemsRef.current.find((i) => i.id === item.id)!
                }
                isAnyTextFocused={isAnyTextFocused}
                onTextFocusChange={setIsAnyTextFocused}
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
          style={styles.participantsContainer}
          contentContainerStyle={styles.participantsScrollContent}
          onScrollEndDrag={(event) => {
            setScrollOffset(event.nativeEvent.contentOffset.x);
            console.log(
              'Participants scroll offset:',
              event.nativeEvent.contentOffset.x,
            );
          }}
          onMomentumScrollEnd={(event) => {
            setScrollOffset(event.nativeEvent.contentOffset.x);
            console.log(
              'Participants scroll offset:',
              event.nativeEvent.contentOffset.x,
            );
          }}
          scrollEventThrottle={16}
        >
          {participants.map((participant) => (
            <Participant
              key = {participant.id}
              id = {participant.id}
              name = {participant.name}
              changeName = {(text) => changeParticipantName(participant.id, text)}
              onLayout={(layout) => {
                participantLayouts.current[participant.id] = {
                  ...layout,
                  x: layout.x + scrollOffset,
                };
                console.log(
                  'Participant',
                  participant.id,
                  'layout.x',
                  layout.x,
                  'adjusted x:',
                  layout.x + scrollOffset,
                );
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.overlayContainer}>
        {/* Dragged item overlay - rendered at root level */}
        {dragState.itemId &&
          dragState.initialPosition &&
          receiptItems.find((item) => item.id === dragState.itemId) && (
            <ReceiptItem
              item={receiptItems.find((item) => item.id === dragState.itemId)!}
              onUpdate={(updates) =>
                updateReceiptItem(dragState.itemId!, updates)
              }
              onDelete={() => {}}
              onRemoveFromUser={(userIndex) =>
                removeItemFromUser(dragState.itemId!, userIndex)
              }
              participantLayouts={participantLayouts.current}
              scrollOffset={scrollOffset}
              onDragStart={() => {}}
              onDragEnd={handleItemDragEnd}
              isDragging={true}
              isDraggingOverlay={true}
              dragPan={dragPan}
              initialPosition={{
                x: dragState.initialPosition.x - ITEMCONTAINERPADDING,
                y: dragState.initialPosition.y - ITEMCONTAINERPADDING,
              }}
              isInParticipantBoundsProp={dragState.isOverParticipant}
              getCurrentItemData={() =>
                receiptItemsRef.current.find(
                  (item) => item.id === dragState.itemId,
                )!
              }
              isAnyTextFocused={isAnyTextFocused}
              onTextFocusChange={setIsAnyTextFocused}
            />
          )}
      </View>

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
    overlayContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'box-none',
    },
    scrollArea: {
      flex: 1,
    },
    itemsContainer: {
      padding: ITEMCONTAINERPADDING,
      height: '80%',
    },
    participantsContainer: {
      height: '20%',
      padding: 16,
    },
    itemsContent: {
      minWidth: '100%',
      alignSelf: 'center',
      zIndex: 1,
    },
    participantsScrollContent: {
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 10,
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
  });
