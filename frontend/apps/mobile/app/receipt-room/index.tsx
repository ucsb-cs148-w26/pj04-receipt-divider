import { ReceiptItem } from '@shared/components/ReceiptItem';
import { ReceiptItemData } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  LayoutRectangle,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
  Text,
  Pressable,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  IconButton,
  AddParticipantSheet,
  AddParticipantManualModal,
  sendRoomInviteSMS,
} from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { File } from 'expo-file-system';
import { extractItems as extractReceiptItems } from '@/services/ocr';
import { Participant } from '@shared/components/Participant';
import { useReceiptItems } from '@/providers';
import { YourItemsRoomParams } from '@/app/items';
import { randomUUID } from 'expo-crypto';
import { useGroupData } from '@/hooks';
import type {
  GroupMember as DbGroupMember,
  ItemClaim as DbItemClaim,
  Item as DbItem,
} from '@eezy-receipt/shared';

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
  photos?: string; // JSON stringified string[] of URIs from create-room
};

export default function ReceiptRoomScreen() {
  const insets = useSafeAreaInsets();
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

  /**---------------- Banner Animation State ---------------- */
  const bannerLerpPan = useRef(new Animated.ValueXY()).current;
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  const bannerScale = useRef(new Animated.Value(1)).current;
  const bannerVisible = useRef(false);
  const [bannerVisibleState, setBannerVisibleState] = useState(false);
  const bannerInitialPosRef = useRef<{ x: number; y: number } | null>(null);
  const bannerItemCountRef = useRef(0);
  const lastDropSuccessful = useRef(false);
  const bannerIsExiting = useRef(false);
  const bannerLerpSpringRef = useRef<Animated.CompositeAnimation | null>(null);
  const exitAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  /**---------------- Text Focus State ---------------- */
  const [isAnyTextFocused, setIsAnyTextFocused] = useState(false);

  /**---------------- Quick Actions State ---------------- */
  const [showQuickActions, setShowQuickActions] = useState(false);

  /**---------------- Add Participant State ---------------- */
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  /**---------------- OCR on initial photos from create-room ---------------- */
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  useEffect(() => {
    if (!params.photos) return;
    let uris: string[] = [];
    try {
      uris = JSON.parse(params.photos);
    } catch {
      return;
    }
    if (!uris.length) return;
    setIsLoadingPhoto(true);
    Promise.all(
      uris.map(async (uri) => {
        const imageBase64 = await new File(uri).base64();
        return extractReceiptItems(imageBase64);
      }),
    )
      .then((results) => {
        receiptItems.setItems((prev) => [...prev, ...results.flat()]);
      })
      .finally(() => {
        setIsLoadingPhoto(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**---------------- Participants Functions ---------------- */
  const addParticipant = (name: string) => {
    if (participants.length >= 10) return;
    const maxID =
      participants.length > 0 ? Math.max(...participants.map((p) => p.id)) : 0;
    const newID = maxID + 1;
    setParticipants((prev) => [...prev, { id: newID, name }]);
  };

  const handleShareSMS = async () => {
    try {
      const result = await sendRoomInviteSMS(roomId);
      if (result === 'sent') {
        setShowAddOptions(false);
      }
    } catch (error) {
      console.error('SMS error:', error);
    }
  };

  const handleShowQR = () => {
    setShowAddOptions(false);
    setShowQRModal(true);
  };

  const handleAddManually = () => {
    Alert.alert(
      'Manual Participant',
      "Adding a participant manually means they won't be linked to a real user account.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Anyway',
          onPress: () => {
            setShowAddOptions(false);
            setShowAddManual(true);
          },
        },
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
    setSelectedItemIds(new Set(displayItems.map((i) => i.id)));
  };

  const deselectAllItems = () => {
    setSelectedItemIds(new Set());
  };

  const claimSelectedToParticipant = (participantId: number) => {
    lastDropSuccessful.current = true;
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => {
        if (!selectedItemIds.has(item.id)) return item;
        const userTags = item.userTags ?? [];
        if (userTags.includes(participantId)) return item;
        return { ...item, userTags: [...userTags, participantId] };
      }),
    );
  };

  /**---------------- Drag Functions ---------------- */
  const handleItemDragStart = (
    itemId: string,
    initialPosition?: { x: number; y: number },
  ) => {
    // Only allow dragging if items are selected and the dragged item is selected
    if (!selectedItemIds.has(itemId) || selectedItemIds.size === 0) return;

    // Stop any in-progress exit animation and reset banner state
    exitAnimRef.current?.stop();
    bannerIsExiting.current = false;
    bannerLerpPan.setValue({ x: 0, y: 0 });
    bannerOpacity.setValue(1);
    bannerScale.setValue(1);
    bannerInitialPosRef.current = initialPosition || null;
    bannerItemCountRef.current = selectedItemIds.size;
    bannerVisible.current = true;
    setBannerVisibleState(true);

    setDragState({
      isDragging: true,
      selectedItemIds: [...selectedItemIds],
      initialPosition: initialPosition || null,
      isOverParticipant: false,
    });
    dragPan.setValue({ x: 0, y: 0 });
  };

  const handleItemDragMove = (translation: { x: number; y: number }) => {
    if (bannerIsExiting.current) return;
    // Don't stop the previous spring — let React Native interrupt it naturally so
    // velocity carries over and the follow stays smooth with no jitter.
    const spring = Animated.spring(bannerLerpPan, {
      toValue: translation,
      useNativeDriver: false,
      tension: 150,
      friction: 26, // slightly over-damped: no oscillation, snappy follow
    });
    bannerLerpSpringRef.current = spring;
    spring.start();
  };

  const handleItemDragEnd = () => {
    const success = lastDropSuccessful.current;
    lastDropSuccessful.current = false;
    bannerIsExiting.current = true;

    // Stop the lerp spring so banner freezes at its current position
    if (bannerLerpSpringRef.current) bannerLerpSpringRef.current.stop();

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

    if (success) {
      // Scale up and fade out at the drop position
      const anim = Animated.parallel([
        Animated.spring(bannerScale, {
          toValue: 1.4,
          useNativeDriver: false,
          tension: 200,
          friction: 8,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: false,
        }),
      ]);
      exitAnimRef.current = anim;
      anim.start(() => {
        setBannerVisibleState(false);
        bannerVisible.current = false;
        bannerIsExiting.current = false;
        // Reset values AFTER state update so there's no frame where the still-mounted
        // component flashes at reset values.
        bannerLerpPan.setValue({ x: 0, y: 0 });
        bannerScale.setValue(1);
        bannerOpacity.setValue(1);
      });
    } else {
      // Spring back to origin and fade out
      const anim = Animated.parallel([
        Animated.spring(bannerLerpPan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          tension: 150,
          friction: 14,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]);
      exitAnimRef.current = anim;
      anim.start(() => {
        setBannerVisibleState(false);
        bannerVisible.current = false;
        bannerIsExiting.current = false;
        bannerLerpPan.setValue({ x: 0, y: 0 });
        // Do NOT reset bannerOpacity here — it was already animated to 0 and the
        // component is now unmounted. Resetting it synchronously before the unmount
        // re-render causes a one-frame flash back to full opacity.
        // It gets reset to 1 at the top of handleItemDragStart for next use.
      });
    }
  };

  const handleParticipantBoundsChange = (isOverParticipant: boolean) => {
    setDragState((prev) => ({ ...prev, isOverParticipant }));
  };

  /**---------------- QR Code State ---------------- */
  //FIXME: MOCK ROOMID, SHOULD BE TAKEN FROM THE BACKEND
  const [roomId] = useState(() => {
    if (params.roomId && typeof params.roomId === 'string') {
      return params.roomId;
    }
    return randomUUID();
  });

  const isGroupRoom =
    !!params.roomId && roomId.length >= 32 && /^[0-9a-f-]{36}$/i.test(roomId);
  const groupData = useGroupData(isGroupRoom ? roomId : '');
  const groupDisplay = useMemo(() => {
    if (!isGroupRoom || !groupData.members.length) {
      return {
        items: [] as ReceiptItemData[],
        participants: [] as ParticipantType[],
      };
    }
    const members = groupData.members as DbGroupMember[];
    const profileIdToParticipantId = new Map<string, number>();
    members.forEach((m, i) =>
      profileIdToParticipantId.set(m.profile_id, i + 1),
    );
    const participants: ParticipantType[] = members.map((_m, i) => ({
      id: i + 1,
      name: `Member ${i + 1}`,
    }));
    const claims = groupData.claims as DbItemClaim[];
    const items = (groupData.items as DbItem[]).map((item) => {
      const claimProfileIds = claims
        .filter((c) => c.item_id === item.id)
        .map((c) => c.profile_id);
      const userTags = claimProfileIds
        .map((pid) => profileIdToParticipantId.get(pid))
        .filter((id): id is number => id != null);
      const amount = typeof item.amount === 'number' ? item.amount : 1;
      const unitPrice =
        typeof item.unit_price === 'number' ? item.unit_price : 0;
      return {
        id: item.id,
        name: item.name ?? '',
        price: String(unitPrice * amount),
        userTags,
      } as ReceiptItemData;
    });
    return { items, participants };
  }, [isGroupRoom, groupData.members, groupData.items, groupData.claims]);

  const displayItems = isGroupRoom ? groupDisplay.items : receiptItems.items;
  const displayParticipants = isGroupRoom
    ? groupDisplay.participants
    : participants;

  /**---------------- Quick Actions Functions ---------------- */
  const claimForAll = () => {
    if (selectedItemIds.size === 0 || displayParticipants.length === 0) return;
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => {
        if (!selectedItemIds.has(item.id)) return item;
        return {
          ...item,
          userTags: [
            ...new Set([
              ...(item.userTags || []),
              ...displayParticipants.map((p) => p.id),
            ]),
          ],
        };
      }),
    );
  };

  const unclaimForAll = () => {
    if (selectedItemIds.size === 0) return;
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => {
        if (!selectedItemIds.has(item.id)) return item;
        return { ...item, userTags: [] };
      }),
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
      {/*
       * ─── LAYERING SYSTEM ───────────────────────────────────────────
       *  z:10  Left button │ Center button   (below overlay)
       *  z:20  Full-screen overlay           (dims everything beneath)
       *  z:30  Right button + dropdown       (above overlay, always interactive)
       *
       * All interactive top-bar elements are direct children of SafeAreaView
       * so React Native sibling z-index rules apply correctly.
       * An invisible spacer View reserves the top-bar height in the
       * normal flex flow so body content sits below the buttons.
       * ──────────────────────────────────────────────────────────────
       */}

      {/* ── Invisible top-bar spacer (claims layout height, passes all touches) ── */}
      <View
        className='px-4'
        style={{ paddingTop: insets.top + 8 }}
        pointerEvents='none'
      >
        <View className='w-[14vw] h-[14vw]' />
      </View>

      {/* ── Body content ── */}
      <View className='flex-1'>
        {/* Middle part - scrollable receipt items */}
        <ScrollView
          className='p-4 flex-1'
          contentContainerClassName='min-w-full self-center z-[1] pb-4'
          scrollEnabled={!dragState.isDragging}
        >
          <View className='gap-2'>
            {displayItems.map((item) => (
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
                onDragMove={handleItemDragMove}
                onDropOnParticipant={claimSelectedToParticipant}
                isDragging={
                  dragState.selectedItemIds.includes(item.id) &&
                  dragState.isDragging
                }
                dragPan={dragPan}
                onParticipantBoundsChange={handleParticipantBoundsChange}
                isInParticipantBoundsProp={false}
                getCurrentItemData={() =>
                  displayItems.find((i) => i.id === item.id)!
                }
                isAnyTextFocused={isAnyTextFocused}
                onTextFocusChange={setIsAnyTextFocused}
                isEditMode={isEditMode}
                isSelected={selectedItemIds.has(item.id)}
                onToggleSelect={() => toggleItemSelection(item.id)}
              />
            ))}

            {/* Add Receipt Item button - edit mode only */}
            {isEditMode && (
              <Pressable
                className='bg-card rounded-2xl border border-border w-full py-4 items-center justify-center active:opacity-70 flex-row gap-2'
                onPress={addReceiptItem}
              >
                <MaterialCommunityIcons
                  name='plus'
                  size={22}
                  className='text-muted-foreground'
                />
                <Text className='text-muted-foreground text-base font-medium'>
                  Add Receipt Item
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        {/* Bottom section - participants and drop zone */}
        <View>
          <ScrollView
            horizontal={true}
            className='px-4 pt-2 pb-6'
            contentContainerClassName='justify-center gap-[10px] flex-grow'
            showsHorizontalScrollIndicator={false}
            onScrollEndDrag={(event) => {
              setScrollOffset(event.nativeEvent.contentOffset.x);
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
            {displayParticipants.map((participant) => (
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
                goToYourItemsPage={() => {
                  if (selectedItemIds.size > 0) {
                    claimSelectedToParticipant(participant.id);
                  } else {
                    router.push({
                      pathname: '../items',
                      params: {
                        items: JSON.stringify(
                          displayItems.filter((item) =>
                            item.userTags?.includes(participant.id),
                          ),
                        ),
                        participantId: participant.id.toString(),
                        participantName: participant.name,
                      } as YourItemsRoomParams,
                    });
                  }
                }}
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
              <View className='items-center justify-center py-5'>
                <MaterialCommunityIcons
                  name='plus'
                  size={32}
                  className='text-accent'
                />
              </View>
            </Pressable>
          </ScrollView>

          {/* Drop to Claim - only show during drag */}
          {dragState.isDragging && (
            <Text className='text-accent text-center text-sm mt-1 mb-2'>
              Drop to Claim
            </Text>
          )}
        </View>
      </View>

      {/* ── Layer 1 (z:10): Left button — below the overlay ── */}
      <View
        className='absolute left-4'
        style={{ zIndex: 10, top: insets.top + 8 }}
      >
        <IconButton
          icon='chevron-left'
          bgClassName='bg-card shadow-md shadow-black/20'
          iconClassName='text-accent-dark'
          pressEffect='fade'
          onPress={() => router.back()}
        />
      </View>

      {/* ── Layer 1 (z:10): Center toggle button — below the overlay ── */}
      <View
        className='absolute inset-x-0 items-center'
        style={{ zIndex: 10, top: insets.top + 8 }}
        pointerEvents='box-none'
      >
        <Pressable
          className={`shadow-md shadow-black/20 w-[14vw] h-[14vw] rounded-2xl items-center justify-center active:opacity-70 ${isEditMode ? 'bg-primary' : 'bg-card'}`}
          disabled={showQuickActions}
          onPress={() => setIsEditMode((prev) => !prev)}
        >
          <MaterialCommunityIcons
            name={isEditMode ? 'check' : 'pencil-outline'}
            size={26}
            color={isEditMode ? '#ffffff' : undefined}
            className={isEditMode ? '' : 'text-primary'}
          />
        </Pressable>
      </View>

      {/* ── Layer 2 (z:20): Full-screen overlay — dims left/center buttons and body ── */}
      {showQuickActions && (
        <Pressable
          className='absolute inset-0 bg-black/50'
          style={{ zIndex: 20 }}
          onPress={() => setShowQuickActions(false)}
        />
      )}

      {/* ── Layer 3 (z:30): Right button + dropdown — always above the overlay ── */}
      <View
        className='absolute right-4'
        style={{ zIndex: 30, top: insets.top + 8 }}
      >
        {showQuickActions && (
          <Pressable className='absolute top-0 right-0' style={{ width: 280 }}>
            <View className='bg-card border border-border rounded-[25px] shadow-lg shadow-black/30 overflow-hidden'>
              {/* Top row of icon buttons */}
              <View className='flex-row items-center justify-around py-3 px-4'>
                <Pressable
                  className='items-center gap-1'
                  onPress={() => {
                    setShowQuickActions(false);
                    router.push('/add-receipt');
                  }}
                >
                  <MaterialCommunityIcons
                    name='receipt-text-plus-outline'
                    size={24}
                    className='text-accent-dark'
                  />
                  <Text className='text-foreground text-xs'>Add Receipt</Text>
                </Pressable>
                <Pressable
                  className='items-center gap-1'
                  onPress={() => {
                    setShowQuickActions(false);
                    router.push(
                      `/qr?roomId=${roomId}&participants=${encodeURIComponent(JSON.stringify(participants))}`,
                    );
                  }}
                >
                  <MaterialCommunityIcons
                    name='account-multiple-plus-outline'
                    size={24}
                    className='text-accent-dark'
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
                    className='text-accent-dark'
                  />
                  <Text className='text-foreground text-xs'>Settings</Text>
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
                  className='text-accent-dark'
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
                  className='text-accent-dark'
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
                  className='text-accent-dark'
                />
                <Text className='text-foreground text-base font-medium'>
                  Claim for All Selected
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
                  className='text-accent-dark'
                />
                <Text className='text-foreground text-base font-medium'>
                  Unclaim for All Selected
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

      {/* Drag overlay - "Claim N items" indicator */}
      {bannerVisibleState && bannerInitialPosRef.current && (
        <Animated.View
          style={{
            position: 'absolute',
            zIndex: 9999,
            elevation: 9999,
            top: bannerInitialPosRef.current.y - 40,
            left: bannerInitialPosRef.current.x - 20,
            opacity: bannerOpacity,
            transform: [
              ...bannerLerpPan.getTranslateTransform(),
              { scale: bannerScale },
            ],
          }}
          pointerEvents='none'
        >
          <View className='bg-primary rounded-2xl px-4 py-4 h-[6vh] w-[45vw] shadow-lg shadow-black/30'>
            <Text className='text-primary-foreground font-bold text-lg text-right'>
              Claim {bannerItemCountRef.current}{' '}
              {bannerItemCountRef.current === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </Animated.View>
      )}

      <AddParticipantSheet
        visible={showAddOptions}
        onClose={() => setShowAddOptions(false)}
        onShareSMS={handleShareSMS}
        onShowQR={handleShowQR}
        onAddManually={handleAddManually}
      />

      <AddParticipantManualModal
        visible={showAddManual}
        onClose={() => setShowAddManual(false)}
        onAdd={(name) => addParticipant(name)}
        addedParticipants={participants}
      />

      {/* QR Code Modal */}
      <Modal
        transparent={false}
        animationType='slide'
        visible={showQRModal}
        onRequestClose={() => {
          setShowQRModal(false);
          setShowAddOptions(true);
        }}
      >
        <SafeAreaView className='flex-1 bg-background'>
          <View className='flex-1 items-center justify-center gap-8 px-6'>
            <Text className='text-foreground text-2xl font-bold'>
              Room QR Code
            </Text>
            <QRCode
              value={`http://localhost:5173/join?roomId=${roomId}`}
              size={220}
              backgroundColor='white'
              color='black'
            />
            <Text className='text-muted-foreground text-sm'>
              Room ID: {roomId}
            </Text>
          </View>
          <View className='px-5 pb-8'>
            <Pressable
              className='py-3 items-center active:opacity-70'
              onPress={() => {
                setShowQRModal(false);
                setShowAddOptions(true);
              }}
            >
              <Text className='text-accent-dark text-base font-medium'>
                Close
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {isLoadingPhoto && (
        <View
          className='absolute bottom-8 left-0 right-0 items-center'
          style={{ zIndex: 1 }}
          pointerEvents='none'
        >
          <View className='bg-card flex-row items-center gap-3 px-5 py-3 rounded-full shadow-md shadow-black/20'>
            <ActivityIndicator size='small' color='#4999DF' />
            <Text className='text-muted-foreground text-sm font-medium'>
              Processing receipt…
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
