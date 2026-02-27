import { useTheme } from '@react-navigation/native';
import { ReceiptItem, USER_COLORS } from '@shared/components/ReceiptItem';
import { ReceiptItemData } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  LayoutRectangle,
  Animated,
} from 'react-native';
import { IconButton, DefaultButtons } from '@eezy-receipt/shared';
import { Participant } from '@shared/components/Participant';
import { useReceiptItems } from '@/providers';
import { YourItemsRoomParams } from '@/app/items';
import { randomUUID } from 'expo-crypto';

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
  itemId: string | null;
  initialPosition: { x: number; y: number } | null;
  isOverParticipant: boolean;
}

interface ParticipantType {
  id: number;
}

export type ReceiptRoomParams = {
  roomId: string;
  items: string;
};

export default function ReceiptRoomScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<ReceiptRoomParams>();
  const receiptItems = useReceiptItems();

  /**---------------- Participants State ---------------- */
  const [participants, setParticipants] = useState<ParticipantType[]>([]);
  const participantLayouts = useRef<Record<number, LayoutRectangle>>({});
  const [scrollOffset, setScrollOffset] = useState(0);
  const [editingParticipantName, setEditingParticipantName] =
    useState<boolean>(false);

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
    const maxID =
      participants.length > 0 ? Math.max(...participants.map((p) => p.id)) : 0;

    const newID = maxID + 1;

    const newParticipant = {
      id: newID,
    };
    setParticipants([...participants, newParticipant]);
  };

  const removeParticipant = (removeID: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== removeID));

    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        userTags: item.userTags?.filter((tagId) => tagId !== removeID) || [],
      })),
    );

    if (participantLayouts.current[removeID]) {
      delete participantLayouts.current[removeID];
    }
  };

  const changeParticipantName = (id: number, newName: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
    );
  };

  /**---------------- Drag Functions ---------------- */
  const handleItemDragStart = (
    itemId: string,
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

  /**---------------- Receipt Items Functions ---------------- */
  const addReceiptItem = () => {
    const newItem: ReceiptItemData = {
      id: randomUUID(),
      name: '',
      price: '',
      userTags: [],
    };
    receiptItems.setItems([...receiptItems?.items, newItem]);
    console.log('All receipt items:', receiptItems);
  };

  const updateReceiptItem = (id: string, updates: Partial<ReceiptItemData>) => {
    receiptItems.setItems((prevItems) => {
      const updatedItems = prevItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      );
      console.log('Updated receipt items:', updatedItems);
      return updatedItems;
    });
  };

  const deleteReceiptItem = (id: string) => {
    receiptItems.setItems(receiptItems.items.filter((item) => item.id !== id));
    console.log('Deleted receipt items:', receiptItems);
  };

  const removeItemFromUser = (itemId: string, userIndex: number) => {
    receiptItems.setItems(
      receiptItems.items.map((item) => {
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
          style={{
            ...styles.itemsContainer,
            height: editingParticipantName ? '50%' : '80%',
          }}
          contentContainerStyle={styles.itemsContent}
          scrollEnabled={!dragState.isDragging}
        >
          <View style={styles.itemsList}>
            {receiptItems.items.map((item) => (
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
                  receiptItems.items.find((i) => i.id === item.id)!
                }
                isAnyTextFocused={isAnyTextFocused}
                onTextFocusChange={setIsAnyTextFocused}
              />
            ))}
            <IconButton
              icon='plus'
              className='bg-white rounded-lg shadow-none border-2 border-gray-400 border-dashed w-full h-[7vh]'
              onPress={addReceiptItem}
              percentageSize={8}
              pressEffect='fade'
              color='#1c1c1c'
              text='Add Receipt Item'
              textPercentageSize={4.5}
            />
          </View>
        </ScrollView>

        <ScrollView
          horizontal={true}
          style={{
            ...styles.participantsContainer,
            height: editingParticipantName ? '50%' : '20%',
          }}
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
          {participants.map((participant) => {
            const color =
              USER_COLORS[(participant.id - 1) % USER_COLORS.length];
            return (
              <Participant
                key={participant.id}
                id={participant.id}
                color={color}
                changeName={(text) =>
                  changeParticipantName(participant.id, text)
                }
                onRemove={() => removeParticipant(participant.id)}
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
                goToYourItemsPage={() =>
                  router.push({
                    pathname: '../items',
                    params: {
                      items: (() => {
                        let senditems = receiptItems.items.filter((item) =>
                          item.userTags?.includes(participant.id),
                        );
                        return senditems
                          ? JSON.stringify(senditems)
                          : JSON.stringify([]);
                      })(),
                      participantId: participant.id.toString(),
                    } as YourItemsRoomParams,
                  })
                }
                onClickTextIn={() => setEditingParticipantName(true)}
                onClickTextOut={() => setEditingParticipantName(false)}
              />
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.overlayContainer}>
        {/* Dragged item overlay - rendered at root level */}
        {dragState.itemId &&
          dragState.initialPosition &&
          receiptItems.items.find((item) => item.id === dragState.itemId) && (
            <ReceiptItem
              item={
                receiptItems.items.find((item) => item.id === dragState.itemId)!
              }
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
                receiptItems.items.find((item) => item.id === dragState.itemId)!
              }
              isAnyTextFocused={isAnyTextFocused}
              onTextFocusChange={setIsAnyTextFocused}
            />
          )}
      </View>

      <View style={styles.buttonRow}>
        <IconButton
          icon='plus'
          className='bg-white/0 rounded-lg shadow-none border-2 border-gray-400 border-dashed size-[25vw]'
          onPress={addParticipant}
          percentageSize={40}
          pressEffect='fade'
          color='#a7a9ae'
        />
        <DefaultButtons.Default
          icon='account-multiple-plus'
          percentageSize={75}
          onPress={() => router.push(`/qr?roomId=${roomId}`)}
        />
        <DefaultButtons.Settings onPress={() => router.navigate('/setting')} />
        <DefaultButtons.Close
          onPress={() => router.push('/close-confirmation')}
        />
      </View>
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
    },
    participantsContainer: {
      padding: 16,
    },
    itemsContent: {
      minWidth: '100%',
      alignSelf: 'center',
      zIndex: 1,
    },
    participantsScrollContent: {
      justifyContent: 'flex-start',
      left: -10,
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
    buttonRow: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: 12,
    },
  });
