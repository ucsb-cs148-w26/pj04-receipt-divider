import { ReceiptItem } from '@shared/components/ReceiptItem';
import { ReceiptItemData } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  LayoutRectangle,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SMS from 'expo-sms';
import { IconButton } from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { extractItems as extractReceiptItems } from '@/services/ocr';
import { Participant } from '@shared/components/Participant';
import { useReceiptItems } from '@/providers';
import { YourItemsRoomParams } from '@/app/items';
import { randomUUID } from 'expo-crypto';

export const ITEMCONTAINERPADDING = 16;

interface DragState {
  isDragging: boolean;
  selectedItemIds: string[];
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
  participants: string; // JSON stringified ParticipantType[]
};

export default function ReceiptRoomScreen() {
  const params = useLocalSearchParams<ReceiptRoomParams>();
  const receiptItems = useReceiptItems();

  /**---------------- Mode State ---------------- */
  const [isEditMode, setIsEditMode] = useState(false);

  /**---------------- Selection State (claim mode) ---------------- */
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );

  /**---------------- Participants State ---------------- */
  const [participants, setParticipants] = useState<ParticipantType[]>(() => {
    try {
      return params.participants ? JSON.parse(params.participants) : [];
    } catch {
      return [];
    }
  });
  const participantLayouts = useRef<Record<number, LayoutRectangle>>({});
  const [scrollOffset, setScrollOffset] = useState(0);

  /**---------------- Drag State ---------------- */
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    selectedItemIds: [],
    initialPosition: null,
    isOverParticipant: false,
  });
  const dragPan = useRef(new Animated.ValueXY()).current;

  /**---------------- Text Focus State ---------------- */
  const [isAnyTextFocused, setIsAnyTextFocused] = useState(false);

  /**---------------- Quick Actions State ---------------- */
  const [showQuickActions, setShowQuickActions] = useState(false);

  /**---------------- Add Participant State ---------------- */
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [newUserName, setNewUserName] = useState('');

  /**---------------- Add Photo ---------------- */
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  const addPhotoFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      const imageBase64 = await new File(result.assets[0].uri).base64();
      setIsLoadingPhoto(true);
      const newItems = await extractReceiptItems(imageBase64);
      receiptItems.setItems([...receiptItems.items, ...newItems]);
      setIsLoadingPhoto(false);
    }
  };

  /**---------------- Participants Functions ---------------- */
  const addParticipant = (name: string) => {
    if (participants.length >= 10) return;
    const maxID =
      participants.length > 0 ? Math.max(...participants.map((p) => p.id)) : 0;
    const newID = maxID + 1;
    setParticipants((prev) => [...prev, { id: newID, name }]);
    setNewUserName('');
    setShowAddManual(false);
  };

  const handleShareSMS = async () => {
    setShowAddOptions(false);
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          'SMS not available',
          'SMS is not available on this device.',
        );
        return;
      }
      const message = `Join my Eezy Receipt room!\n\nRoom ID: ${roomId}\n\nOr tap this link to join: https://example.com/join?roomId=${roomId}`;
      await SMS.sendSMSAsync([], message);
    } catch (error) {
      console.error('SMS error:', error);
    }
  };

  const handleShowQR = () => {
    setShowAddOptions(false);
    router.push(`/qr?roomId=${roomId}`);
  };

  const handleAddManually = () => {
    setShowAddOptions(false);
    Alert.alert(
      'Manual Participant',
      "Adding a participant manually means they won't be linked to a real user account.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Anyway', onPress: () => setShowAddManual(true) },
      ],
    );
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

  /**---------------- Selection Functions ---------------- */
  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const selectAllItems = () => {
    setSelectedItemIds(new Set(receiptItems.items.map((i) => i.id)));
  };

  const deselectAllItems = () => {
    setSelectedItemIds(new Set());
  };

  /**---------------- Drag Functions ---------------- */
  const handleItemDragStart = (
    itemId: string,
    initialPosition?: { x: number; y: number },
  ) => {
    // Only allow dragging if items are selected and the dragged item is selected
    if (!selectedItemIds.has(itemId) || selectedItemIds.size === 0) return;
    setDragState({
      isDragging: true,
      selectedItemIds: [...selectedItemIds],
      initialPosition: initialPosition || null,
      isOverParticipant: false,
    });
    dragPan.setValue({ x: 0, y: 0 });
  };

  const handleItemDragEnd = () => {
    setDragState({
      isDragging: false,
      selectedItemIds: [],
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
    if (params.roomId && typeof params.roomId === 'string') {
      return params.roomId;
    }
    return Math.random().toString(36).substring(2, 9);
  });

  /**---------------- Claim Selected Items ---------------- */
  const claimSelectedToParticipant = (participantId: number) => {
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => {
        if (!selectedItemIds.has(item.id)) return item;
        const tags = item.userTags ?? [];
        if (tags.includes(participantId)) return item;
        return { ...item, userTags: [...tags, participantId] };
      }),
    );
    setSelectedItemIds(new Set());
  };

  /**---------------- Quick Actions Functions ---------------- */
  const claimForAll = () => {
    if (receiptItems.items.length === 0 || participants.length === 0) return;
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        userTags: [
          ...new Set([
            ...(item.userTags || []),
            ...participants.map((p) => p.id),
          ]),
        ],
      })),
    );
  };

  const unclaimForAll = () => {
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => ({ ...item, userTags: [] })),
    );
  };

  /**---------------- Receipt Items Functions ---------------- */
  const addReceiptItem = () => {
    const newItem: ReceiptItemData = {
      id: randomUUID(),
      name: '',
      price: '',
      userTags: [],
    };
    receiptItems.setItems([...receiptItems.items, newItem]);
  };

  const updateReceiptItem = (id: string, updates: Partial<ReceiptItemData>) => {
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  };

  const deleteReceiptItem = (id: string) => {
    receiptItems.setItems(receiptItems.items.filter((item) => item.id !== id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeItemFromUser = (itemId: string, userId: number) => {
    receiptItems.setItems(
      receiptItems.items.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            userTags: item.userTags?.filter((tag) => tag !== userId),
          };
        }
        return item;
      }),
    );
  };

  /**---------------- Computed Values ---------------- */
  const getParticipantItemCount = (participantId: number) => {
    return receiptItems.items.filter((item) =>
      item.userTags?.includes(participantId),
    ).length;
  };

  const getParticipantTotal = (participantId: number) => {
    return receiptItems.items
      .filter((item) => item.userTags?.includes(participantId))
      .reduce((sum, item) => {
        const price = parseFloat(item.price || '0');
        const discount = parseFloat(item.discount || '0');
        const claimCount = item.userTags?.length || 1;
        return sum + (price - discount) / claimCount;
      }, 0)
      .toFixed(2);
  };

  /**---------------- Render ---------------- */
  return (
    <SafeAreaView className='bg-background flex-1'>
      {/* Top bar */}
      <View className='z-20 px-4 py-2'>
        <View className='flex-row items-center justify-between'>
          {/* Left side buttons */}
          <View className='flex-row items-center gap-2'>
            <IconButton
              icon='chevron-left'
              bgClassName='bg-card shadow-md shadow-black/20'
              iconClassName='text-accent-dark'
              pressEffect='fade'
              onPress={() => router.back()}
            />
          </View>

          {/* Center toggle button */}
          <Pressable
            className='bg-card shadow-md shadow-black/20 w-[14vw] h-[14vw] rounded-2xl items-center justify-center active:opacity-70'
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <MaterialCommunityIcons
              name={isEditMode ? 'receipt' : 'pencil-outline'}
              size={26}
              color='var(--color-primary)'
            />
          </Pressable>

          {/* Right side buttons */}
          <View className='flex-row items-center gap-2'>
            <View>
              {showQuickActions && (
                <Pressable
                  className='absolute top-0 right-0 z-30'
                  style={{ width: 280 }}
                >
                  <View className='bg-card border border-border rounded-[25px] shadow-lg shadow-black/30 overflow-hidden'>
                    {/* Top row of icon buttons */}
                    <View className='flex-row items-center justify-around py-3 px-4'>
                      <Pressable
                        className='items-center gap-1'
                        onPress={() => {
                          setShowQuickActions(false);
                          addPhotoFromLibrary();
                        }}
                      >
                        <MaterialCommunityIcons
                          name='file-image-plus-outline'
                          size={24}
                          color='var(--color-accent-dark)'
                        />
                        <Text className='text-foreground text-xs'>
                          Add Photo
                        </Text>
                      </Pressable>
                      <Pressable
                        className='items-center gap-1'
                        onPress={() => {
                          setShowQuickActions(false);
                          router.push(`/qr?roomId=${roomId}`);
                        }}
                      >
                        <MaterialCommunityIcons
                          name='account-multiple-plus-outline'
                          size={24}
                          color='var(--color-accent-dark)'
                        />
                        <Text className='text-foreground text-xs'>Share</Text>
                      </Pressable>
                      <Pressable
                        className='items-center gap-1'
                        onPress={() => {
                          setShowQuickActions(false);
                          router.navigate('/setting');
                        }}
                      >
                        <MaterialCommunityIcons
                          name='cog-outline'
                          size={24}
                          color='var(--color-accent-dark)'
                        />
                        <Text className='text-foreground text-xs'>
                          Settings
                        </Text>
                      </Pressable>
                    </View>

                    <View className='h-px bg-border' />

                    {/* Menu items */}
                    <Pressable
                      className='flex-row items-center gap-3 px-4 py-3 active:opacity-70'
                      onPress={() => {
                        selectAllItems();
                        setShowQuickActions(false);
                      }}
                    >
                      <MaterialCommunityIcons
                        name='checkbox-multiple-marked-outline'
                        size={22}
                        color='var(--color-accent-dark)'
                      />
                      <Text className='text-foreground text-base font-medium'>
                        Select All Items
                      </Text>
                    </Pressable>

                    <Pressable
                      className='flex-row items-center gap-3 px-4 py-3 active:opacity-70'
                      onPress={() => {
                        deselectAllItems();
                        setShowQuickActions(false);
                      }}
                    >
                      <MaterialCommunityIcons
                        name='checkbox-multiple-blank-outline'
                        size={22}
                        color='var(--color-accent-dark)'
                      />
                      <Text className='text-foreground text-base font-medium'>
                        Deselect All Items
                      </Text>
                    </Pressable>

                    <Pressable
                      className='flex-row items-center gap-3 px-4 py-3 active:opacity-70'
                      onPress={() => {
                        claimForAll();
                        setShowQuickActions(false);
                      }}
                    >
                      <MaterialCommunityIcons
                        name='download'
                        size={22}
                        color='var(--color-accent-dark)'
                      />
                      <Text className='text-foreground text-base font-medium'>
                        Claim for All
                      </Text>
                    </Pressable>

                    <Pressable
                      className='flex-row items-center gap-3 px-4 py-3 active:opacity-70'
                      onPress={() => {
                        unclaimForAll();
                        setShowQuickActions(false);
                      }}
                    >
                      <MaterialCommunityIcons
                        name='upload'
                        size={22}
                        color='var(--color-accent-dark)'
                      />
                      <Text className='text-foreground text-base font-medium'>
                        Unclaim for All
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
              <IconButton
                icon='dots-horizontal'
                bgClassName='bg-card shadow-md shadow-black/20'
                iconClassName='text-accent-dark'
                pressEffect='fade'
                onPress={() => setShowQuickActions((prev) => !prev)}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Dismiss popup overlay */}
      {showQuickActions && (
        <Pressable
          className='absolute inset-0 z-10 bg-black/50'
          onPress={() => setShowQuickActions(false)}
        />
      )}

      <View className='flex-1'>
        {/* Middle part - scrollable receipt items */}
        <ScrollView
          className='p-4 flex-1'
          contentContainerClassName='min-w-full self-center z-[1] pb-4'
          scrollEnabled={!dragState.isDragging}
        >
          <View className='gap-2'>
            {receiptItems.items.map((item) => (
              <ReceiptItem
                key={item.id}
                item={item}
                onUpdate={(updates) => updateReceiptItem(item.id, updates)}
                onDelete={() => deleteReceiptItem(item.id)}
                onRemoveFromUser={(userId) =>
                  removeItemFromUser(item.id, userId)
                }
                participantLayouts={participantLayouts.current}
                scrollOffset={scrollOffset}
                onDragStart={(_itemId, initialPosition) =>
                  handleItemDragStart(item.id, initialPosition)
                }
                onDragEnd={handleItemDragEnd}
                isDragging={
                  dragState.selectedItemIds.includes(item.id) &&
                  dragState.isDragging
                }
                dragPan={
                  dragState.selectedItemIds.includes(item.id)
                    ? dragPan
                    : undefined
                }
                onParticipantBoundsChange={handleParticipantBoundsChange}
                isInParticipantBoundsProp={false}
                getCurrentItemData={() =>
                  receiptItems.items.find((i) => i.id === item.id)!
                }
                isAnyTextFocused={isAnyTextFocused}
                onTextFocusChange={setIsAnyTextFocused}
                isEditMode={isEditMode}
                isSelected={selectedItemIds.has(item.id)}
                onToggleSelect={() => toggleItemSelection(item.id)}
                onClaimToParticipant={claimSelectedToParticipant}
              />
            ))}

            {/* Add Receipt Item button - always visible */}
            <Pressable
              className='bg-card rounded-2xl border border-border w-full py-4 items-center justify-center active:opacity-70 flex-row gap-2'
              onPress={addReceiptItem}
            >
              <MaterialCommunityIcons
                name='plus'
                size={22}
                color='var(--color-muted-foreground)'
              />
              <Text className='text-muted-foreground text-base font-medium'>
                Add Receipt Item
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Bottom section - participants and drop zone */}
        <View>
          {/* Drop to Claim - only show during drag */}
          {dragState.isDragging && (
            <Text className='text-accent text-center text-sm mb-1'>
              Drop to Claim
            </Text>
          )}

          <ScrollView
            horizontal={true}
            className='px-4 pb-6'
            contentContainerClassName='gap-3'
            showsHorizontalScrollIndicator={false}
            onScrollEndDrag={(event) => {
              setScrollOffset(event.nativeEvent.contentOffset.x);
            }}
            onMomentumScrollEnd={(event) => {
              setScrollOffset(event.nativeEvent.contentOffset.x);
            }}
            scrollEventThrottle={16}
          >
            {participants.map((participant) => (
              <Participant
                key={participant.id}
                id={participant.id}
                name={participant.name}
                itemCount={getParticipantItemCount(participant.id)}
                totalAmount={getParticipantTotal(participant.id)}
                onRemove={() => removeParticipant(participant.id)}
                onLayout={(layout) => {
                  participantLayouts.current[participant.id] = {
                    ...layout,
                    x: layout.x + scrollOffset,
                  };
                }}
                goToYourItemsPage={() =>
                  router.push({
                    pathname: '../items',
                    params: {
                      items: JSON.stringify(
                        receiptItems.items.filter((item) =>
                          item.userTags?.includes(participant.id),
                        ),
                      ),
                      participantId: participant.id.toString(),
                    } as YourItemsRoomParams,
                  })
                }
                isEditMode={isEditMode}
              />
            ))}

            {/* Add participant button - always visible */}
            <Pressable
              className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10'
              style={{ width: 160 }}
              onPress={() => setShowAddOptions(true)}
            >
              <View className='h-2 bg-accent-light' />
              <View className='flex-1 items-center justify-center py-6'>
                <MaterialCommunityIcons
                  name='plus'
                  size={32}
                  color='var(--color-accent)'
                />
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </View>

      {/* Drag overlay - "Claim N items" indicator */}
      {dragState.isDragging && dragState.initialPosition && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              zIndex: 9999,
              elevation: 9999,
              top: dragState.initialPosition.y,
              left: dragState.initialPosition.x - ITEMCONTAINERPADDING,
              transform: dragPan.getTranslateTransform(),
            },
          ]}
          pointerEvents='none'
        >
          <View className='bg-primary rounded-2xl px-8 py-4 shadow-lg shadow-black/30'>
            <Text className='text-primary-foreground font-bold text-lg text-center'>
              Claim {dragState.selectedItemIds.length}{' '}
              {dragState.selectedItemIds.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Add Participant Options Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={showAddOptions}
        onRequestClose={() => setShowAddOptions(false)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-end'
          onPress={() => setShowAddOptions(false)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-t-2xl p-6'>
              <Text className='text-foreground text-xl font-bold mb-4'>
                Add Participant
              </Text>
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleShareSMS}
              >
                <MaterialCommunityIcons
                  name='message-text'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>
                  Share Link via SMS
                </Text>
              </Pressable>
              <View className='h-px bg-border my-1' />
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleShowQR}
              >
                <MaterialCommunityIcons
                  name='qrcode'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>
                  Show Room QR Code
                </Text>
              </Pressable>
              <View className='h-px bg-border my-1' />
              <Pressable
                className='flex-row items-center gap-4 py-3 active:opacity-70'
                onPress={handleAddManually}
              >
                <MaterialCommunityIcons
                  name='account-plus'
                  size={24}
                  color='#4999DF'
                />
                <Text className='text-foreground text-base'>Add Manually</Text>
              </Pressable>
              <Pressable
                className='mt-3 py-3 items-center active:opacity-70'
                onPress={() => setShowAddOptions(false)}
              >
                <Text className='text-accent-dark text-base font-medium'>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Participant Manual Modal */}
      <Modal
        transparent
        animationType='fade'
        visible={showAddManual}
        onRequestClose={() => setShowAddManual(false)}
      >
        <Pressable
          className='flex-1 bg-black/50 justify-center items-center px-6'
          onPress={() => setShowAddManual(false)}
        >
          <Pressable onPress={() => {}}>
            <View className='bg-card rounded-2xl p-6 w-80'>
              <View className='flex-row items-center justify-between mb-4'>
                <Text className='text-foreground text-xl font-bold'>
                  Add Participant
                </Text>
                <Pressable onPress={() => setShowAddManual(false)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name='close'
                    size={22}
                    color='var(--color-accent-dark)'
                  />
                </Pressable>
              </View>
              <TextInput
                placeholder='Name'
                placeholderTextColor='var(--color-muted-foreground)'
                value={newUserName}
                onChangeText={setNewUserName}
                onSubmitEditing={() =>
                  newUserName.trim() && addParticipant(newUserName.trim())
                }
                returnKeyType='done'
                className='border border-border rounded-xl px-4 py-3 text-foreground mb-4'
                autoFocus
              />
              <Pressable
                className='bg-primary rounded-xl py-3 items-center active:opacity-80'
                onPress={() =>
                  newUserName.trim() && addParticipant(newUserName.trim())
                }
              >
                <Text className='text-primary-foreground font-bold'>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType='fade'
        visible={isLoadingPhoto}
        statusBarTranslucent
      >
        <View className='flex-1 justify-center items-center bg-black/50'>
          <View className='bg-card p-6 rounded-xl items-center'>
            <ActivityIndicator size='large' color='#4999DF' />
            <Text className='mt-4 text-lg font-medium text-muted-foreground'>
              Loading...
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
