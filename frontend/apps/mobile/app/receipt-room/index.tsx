import { ReceiptItem, USER_COLORS } from '@shared/components/ReceiptItem';
import { ReceiptItemData } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
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
    <View className='bg-background flex-1 pt-[60px]'>
      <View className='flex-1'>
        {/* Middle part - scrollable receipt items */}
        <ScrollView
          style={{ height: editingParticipantName ? '50%' : '80%' }}
          className='p-4'
          contentContainerClassName='min-w-full self-center z-[1]'
          scrollEnabled={!dragState.isDragging}
        >
          <View className='gap-2'>
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
          style={{ height: editingParticipantName ? '50%' : '20%' }}
          className='p-4'
          contentContainerClassName='justify-start -left-[10px] gap-[10px]'
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

      <View className='absolute inset-0' pointerEvents='box-none'>
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

      <View className='flex-col items-center gap-2 p-3'>
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
