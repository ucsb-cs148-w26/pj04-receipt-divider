import { ReceiptItem } from '@shared/components/ReceiptItem';
import { ReceiptItemData } from '@shared/types';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  LayoutRectangle,
  Animated,
  ActivityIndicator,
  Alert,
  Text,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import {
  IconButton,
  AddParticipantSheet,
  AddParticipantManualModal,
  sendRoomInviteSMS,
  useScrollToInput,
} from '@eezy-receipt/shared';
import { ReceiptConfidenceModal, type ConfidenceData } from '@/components';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Participant } from '@shared/components/Participant';
import { useReceiptItems, useAuth } from '@/providers';
import { YourItemsRoomParams } from '@/app/items';
import { randomUUID } from 'expo-crypto';
import { useGroupData } from '@/hooks';
import {
  addReceipt,
  assignItem,
  assignItems,
  unassignItem,
  unassignItems,
  updateItem,
  deleteItem,
  deleteReceipt,
  addItem,
  createManualReceipt,
  updateReceiptTax,
  updateGroupName,
  updateUsername,
} from '@/services/groupApi';
import { supabase } from '@/services/supabase';
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
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  /**---------------- Group Name State ---------------- */
  const [groupName, setGroupName] = useState('');
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);

  /**---------------- Mode State ---------------- */
  const [isEditMode, setIsEditMode] = useState(false);

  /**---------------- Scroll-to-input context (edit mode) ---------------- */
  const scrollCtx = useScrollToInput({ resetOnBlur: false });

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
  const bannerTranslation = useSharedValue({ x: 0, y: 0 });
  const bannerOpacityS = useSharedValue(1);
  const bannerScaleS = useSharedValue(1);
  const bannerVisible = useRef(false);
  const [bannerVisibleState, setBannerVisibleState] = useState(false);
  const bannerInitialPosRef = useRef<{ x: number; y: number } | null>(null);
  const bannerItemCountRef = useRef(0);
  const lastDropSuccessful = useRef(false);
  const bannerAnimStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacityS.value,
    transform: [
      { translateX: bannerTranslation.value.x },
      { translateY: bannerTranslation.value.y },
      { scale: bannerScaleS.value },
    ],
  }));
  const dropToClaimAnim = useRef(new Animated.Value(40)).current;
  const dropToClaimOpacity = useRef(new Animated.Value(0)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const editModeAnim = useRef(new Animated.Value(0)).current;
  const [isEditAnimating, setIsEditAnimating] = useState(false);

  /**---------------- Text Focus State ---------------- */
  const [isAnyTextFocused, setIsAnyTextFocused] = useState(false);
  const isAnyTextFocusedRef = useRef(false);
  useEffect(() => {
    isAnyTextFocusedRef.current = isAnyTextFocused;
  }, [isAnyTextFocused]);

  /**---------------- Debounce timers for item updates ---------------- */
  const itemUpdateTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  /**---------------- Quick Actions State ---------------- */
  const [showQuickActions, setShowQuickActions] = useState(false);

  /**---------------- Add Participant State ---------------- */
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);

  /**---------------- Add Item Sheet State ---------------- */
  const [showAddItemSheet, setShowAddItemSheet] = useState(false);
  const [addItemReceiptChoice, setAddItemReceiptChoice] = useState<
    string | null
  >(null);
  const [addItemTax, setAddItemTax] = useState('');

  const [isAddingItem, setIsAddingItem] = useState(false);

  /**---------------- OCR on initial photos from create-room ---------------- */
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Receipt IDs we're waiting to see appear in the realtime cache. */
  const pendingReceiptIdsRef = useRef<Set<string>>(new Set());
  /** Confidence data to show once items arrive. */
  const [pendingConfidence, setPendingConfidence] =
    useState<ConfidenceData | null>(null);
  const [showConfidenceModal, setShowConfidenceModal] = useState(false);

  const handleRefresh = async () => {
    if (!isGroupRoom) return;
    setIsRefreshing(true);
    await groupData.refetch();
    setIsRefreshing(false);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(dropToClaimAnim, {
        toValue: dragState.isDragging ? 0 : 40,
        useNativeDriver: true,
      }),
      Animated.timing(dropToClaimOpacity, {
        toValue: dragState.isDragging ? 1 : 0,
        duration: dragState.isDragging ? 200 : 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [dragState.isDragging, dropToClaimAnim, dropToClaimOpacity]);

  useEffect(() => {
    Animated.timing(dropdownOpacity, {
      toValue: showQuickActions ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showQuickActions, dropdownOpacity]);

  // editModeAnim is driven imperatively via toggleEditMode() — no useEffect needed.

  useEffect(() => {
    if (!params.photos || !roomId) return;
    let uris: string[] = [];
    try {
      uris = JSON.parse(params.photos);
    } catch {
      return;
    }
    if (!uris.length) return;
    setIsLoadingPhoto(true);
    // Upload each photo; items + receipts arrive via Supabase Realtime.
    // We hold the loading indicator until those receipts appear in the cache.
    const collectedConfidence: ConfidenceData[] = [];
    Promise.all(
      uris.map(async (uri) => {
        const result = await addReceipt(roomId, uri);
        pendingReceiptIdsRef.current.add(result.receiptId);
        if (result.confidenceScore != null) {
          collectedConfidence.push({
            confidenceScore: result.confidenceScore,
            warnings: result.warnings,
            notes: result.notes,
            tax: result.tax,
            ocrTotal: result.ocrTotal,
          });
        }
      }),
    )
      .then(() => {
        // Store aggregated confidence (use first receipt's score for simplicity)
        if (collectedConfidence.length > 0) {
          setPendingConfidence(collectedConfidence[0]);
        }
        // Loading is cleared by the groupData watcher below once receipts arrive.
      })
      .catch((err) => {
        Alert.alert(
          'Upload Failed',
          err instanceof Error ? err.message : 'Could not process receipt.',
        );
        setIsLoadingPhoto(false);
      });

    // Fallback: stop loading after 20 seconds regardless
    const fallback = setTimeout(() => {
      if (pendingReceiptIdsRef.current.size > 0) {
        pendingReceiptIdsRef.current = new Set();
        setIsLoadingPhoto(false);
      }
    }, 20_000);
    return () => clearTimeout(fallback);
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
      Alert.alert(
        'Failed to Send',
        'Could not send the invite SMS. Please try again.',
      );
    }
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

  const renameParticipant = (id: number, newName: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
    );
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
    const itemsSnapshot = receiptItems.items;
    const selectedItems = itemsSnapshot.filter((item) =>
      selectedItemIds.has(item.id),
    );
    const allAlreadyClaimed = selectedItems.every((item) =>
      (item.userTags ?? []).includes(participantId),
    );
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => {
        if (!selectedItemIds.has(item.id)) return item;
        const userTags = item.userTags ?? [];
        if (allAlreadyClaimed) {
          return {
            ...item,
            userTags: userTags.filter((id) => id !== participantId),
          };
        }
        if (userTags.includes(participantId)) return item;
        return { ...item, userTags: [...userTags, participantId] };
      }),
    );
    // Fire backend assign call(s) when in a real group — bulk when >1 item selected
    if (isGroupRoom) {
      const profileId =
        groupDisplay.participantIdToProfileId.get(participantId);
      if (profileId) {
        const ids = [...selectedItemIds];
        const req =
          ids.length === 1
            ? assignItem(ids[0], profileId)
            : assignItems(ids, profileId);
        req.catch((err) => {
          receiptItems.setItems(itemsSnapshot);
          Alert.alert(
            'Error',
            'Failed to assign item. Changes have been reverted.',
          );
          console.error(err);
        });
      }
    }
    setSelectedItemIds(new Set());
  };

  /**---------------- Drag Functions ---------------- */
  const handleItemDragStart = (
    itemId: string,
    initialPosition?: { x: number; y: number },
  ) => {
    // Build effective selection: include the dragged item even if not yet selected
    const effectiveIds = selectedItemIds.has(itemId)
      ? selectedItemIds
      : new Set([...selectedItemIds, itemId]);

    // If the item wasn't selected, select it now so the UI reflects it
    if (!selectedItemIds.has(itemId)) {
      setSelectedItemIds(effectiveIds);
    }

    // Cancel any in-progress exit animations and reset banner state
    cancelAnimation(bannerTranslation);
    cancelAnimation(bannerOpacityS);
    cancelAnimation(bannerScaleS);
    bannerTranslation.value = { x: 0, y: 0 };
    bannerOpacityS.value = 1;
    bannerScaleS.value = 1;
    bannerInitialPosRef.current = initialPosition || null;
    bannerItemCountRef.current = effectiveIds.size;
    bannerVisible.current = true;
    setBannerVisibleState(true);

    setDragState({
      isDragging: true,
      selectedItemIds: [...effectiveIds],
      initialPosition: initialPosition || null,
      isOverParticipant: false,
    });
    dragPan.setValue({ x: 0, y: 0 });
  };

  const handleItemDragEnd = () => {
    const success = lastDropSuccessful.current;
    lastDropSuccessful.current = false;

    setDragState({
      isDragging: false,
      selectedItemIds: [],
      initialPosition: null,
      isOverParticipant: false,
    });
    Animated.spring(dragPan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();

    if (success) {
      // Scale up and fade out at the drop position — runs entirely on the UI thread
      bannerScaleS.value = withSpring(1.4, {
        mass: 1,
        stiffness: 200,
        damping: 8,
      });
      bannerOpacityS.value = withTiming(0, { duration: 280 }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setBannerVisibleState)(false);
          // Values reset at the top of the next handleItemDragStart
        }
      });
    } else {
      // Fade out at current position
      bannerTranslation.value = { x: 0, y: 0 };
      bannerOpacityS.value = withTiming(0, { duration: 300 }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setBannerVisibleState)(false);
          // Values reset at the top of the next handleItemDragStart
        }
      });
    }
  };

  const handleParticipantBoundsChange = (isOverParticipant: boolean) => {
    setDragState((prev) => ({ ...prev, isOverParticipant }));
  };

  /**---------------- QR Code State ---------------- */
  // roomId comes from route params (set by create-room after POST /group/create)
  // or falls back to a value passed directly for existing rooms
  const [roomId] = useState(() => {
    if (params.roomId && typeof params.roomId === 'string') {
      return params.roomId;
    }
    return '';
  });

  const isGroupRoom =
    !!params.roomId && roomId.length >= 32 && /^[0-9a-f-]{36}$/i.test(roomId);
  const groupData = useGroupData(isGroupRoom ? roomId : '');
  const isHost =
    isGroupRoom &&
    !!groupData.createdBy &&
    groupData.createdBy === currentUserId;

  // Fetch group name from Supabase when entering a real group room
  useEffect(() => {
    if (!isGroupRoom || !currentUserId) return;
    (async () => {
      const { data } = await supabase
        .from('groups')
        .select('name')
        .eq('id', roomId)
        .single();
      setGroupName(data?.name ?? '');
    })();
  }, [roomId, isGroupRoom, currentUserId]);

  const groupDisplay = useMemo(() => {
    if (!isGroupRoom || !groupData.members.length) {
      return {
        items: [] as ReceiptItemData[],
        participants: [] as ParticipantType[],
        participantIdToProfileId: new Map<number, string>(),
      };
    }
    const members = groupData.members as DbGroupMember[];
    const profileIdToParticipantId = new Map<string, number>();
    const participantIdToProfileId = new Map<number, string>();
    members.forEach((m, i) => {
      profileIdToParticipantId.set(m.profile_id, i + 1);
      participantIdToProfileId.set(i + 1, m.profile_id);
    });
    const participants: ParticipantType[] = members.map((m, i) => ({
      id: i + 1,
      name: groupData.profiles[m.profile_id]?.username ?? `Member ${i + 1}`,
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
        price: (unitPrice * amount).toFixed(2),
        userTags,
        receiptId: item.receipt_id ?? null,
      } as ReceiptItemData;
    });
    return { items, participants, participantIdToProfileId };
  }, [
    isGroupRoom,
    groupData.members,
    groupData.items,
    groupData.claims,
    groupData.profiles,
  ]);

  // Keep receiptItems in sync with Supabase data for group rooms.
  // Sync is paused while a TextInput is focused so in-progress edits are not overwritten.
  useEffect(() => {
    if (!isGroupRoom || isAnyTextFocusedRef.current) return;
    receiptItems.setItems(groupDisplay.items);
  }, [groupDisplay.items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the loading overlay once all uploaded receipts have arrived in the cache.
  useEffect(() => {
    if (!isLoadingPhoto || pendingReceiptIdsRef.current.size === 0) return;
    const allArrived = [...pendingReceiptIdsRef.current].every((rid) =>
      groupData.receipts.some((r) => r.id === rid),
    );
    if (allArrived) {
      pendingReceiptIdsRef.current = new Set();
      setIsLoadingPhoto(false);
      if (pendingConfidence) {
        setShowConfidenceModal(true);
      }
    }
  }, [groupData.receipts, isLoadingPhoto, pendingConfidence]);

  const displayItems = receiptItems.items;
  const displayParticipants = isGroupRoom
    ? groupDisplay.participants
    : participants;

  // Map receipt id → uploader display name (only meaningful in group rooms)
  const receiptUploaderMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of groupData.receipts) {
      const name = groupData.profiles[r.created_by]?.username ?? 'Someone';
      m.set(r.id, r.created_by === currentUserId ? 'You' : name);
    }
    return m;
  }, [groupData.receipts, groupData.profiles, currentUserId]);

  // Map receipt id → tax amount (null/0 if not present)
  const receiptTaxMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of groupData.receipts) {
      if (r.tax != null && r.tax > 0) m.set(r.id, r.tax);
    }
    return m;
  }, [groupData.receipts]);

  // Map receipt id → tax per item (receipt.tax / itemCount), for participant totals
  const taxPerItemMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const [rid, tax] of receiptTaxMap.entries()) {
      const count = displayItems.filter((i) => i.receiptId === rid).length;
      if (count > 0) m.set(rid, tax / count);
    }
    return m;
  }, [receiptTaxMap, displayItems]);

  // Show the Complete button when every item in a group room has at least one claimant
  const allItemsAssigned =
    isGroupRoom &&
    displayItems.length > 0 &&
    displayItems.every((item) => item.userTags && item.userTags.length > 0);

  // Group display items by receipt id (preserves order)
  const itemSections = useMemo(() => {
    if (!isGroupRoom)
      return [{ receiptId: null as string | null, items: displayItems }];
    const order: (string | null)[] = [];
    const map = new Map<string | null, ReceiptItemData[]>();
    for (const item of displayItems) {
      const rid = item.receiptId ?? null;
      if (!map.has(rid)) {
        order.push(rid);
        map.set(rid, []);
      }
      map.get(rid)!.push(item);
    }
    return order.map((rid) => ({ receiptId: rid, items: map.get(rid)! }));
  }, [isGroupRoom, displayItems]);

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
    // Fire backend assign calls — one bulk request per participant
    if (isGroupRoom) {
      const ids = [...selectedItemIds];
      let claimAlertShown = false;
      displayParticipants.forEach((p) => {
        const profileId = groupDisplay.participantIdToProfileId.get(p.id);
        if (!profileId) return;
        (ids.length === 1
          ? assignItem(ids[0], profileId)
          : assignItems(ids, profileId)
        ).catch((err) => {
          console.error(err);
          if (!claimAlertShown) {
            claimAlertShown = true;
            Alert.alert('Error', 'Failed to claim items. Please try again.');
          }
        });
      });
    }
  };

  const unclaimForAll = () => {
    if (selectedItemIds.size === 0) return;
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) => {
        if (!selectedItemIds.has(item.id)) return item;
        return { ...item, userTags: [] };
      }),
    );
    // Fire backend unassign calls — group items by participant then bulk-unassign
    if (isGroupRoom) {
      const byProfile = new Map<string, string[]>();
      [...selectedItemIds].forEach((itemId) => {
        const item = displayItems.find((i) => i.id === itemId);
        (item?.userTags ?? []).forEach((pId) => {
          const profileId = groupDisplay.participantIdToProfileId.get(pId);
          if (profileId) {
            const arr = byProfile.get(profileId) ?? [];
            arr.push(itemId);
            byProfile.set(profileId, arr);
          }
        });
      });
      let unclaimAlertShown = false;
      byProfile.forEach((ids, profileId) => {
        (ids.length === 1
          ? unassignItem(ids[0], profileId)
          : unassignItems(ids, profileId)
        ).catch((err) => {
          console.error(err);
          if (!unclaimAlertShown) {
            unclaimAlertShown = true;
            Alert.alert('Error', 'Failed to unclaim items. Please try again.');
          }
        });
      });
    }
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

  const handleAddReceiptItem = () => {
    if (!isGroupRoom) {
      addReceiptItem();
      return;
    }
    setAddItemReceiptChoice(null);
    setAddItemTax('');
    setShowAddItemSheet(true);
  };

  const confirmAddItem = async () => {
    setShowAddItemSheet(false);
    setIsAddingItem(true);
    try {
      let finalReceiptId: string | null = null;
      const taxValue = parseFloat(addItemTax);
      if (addItemReceiptChoice === 'new') {
        const { receiptId } = await createManualReceipt(
          roomId,
          isNaN(taxValue) ? null : taxValue,
        );
        finalReceiptId = receiptId;
      } else if (addItemReceiptChoice !== null) {
        finalReceiptId = addItemReceiptChoice;
        if (!isNaN(taxValue)) {
          updateReceiptTax(finalReceiptId, taxValue).catch((err) => {
            console.error(err);
            Alert.alert(
              'Tax Update Failed',
              'The item was added but the tax could not be saved. Please try again.',
            );
          });
        }
      }
      const { itemId } = await addItem(roomId, finalReceiptId);
      receiptItems.setItems((prev) => [
        ...prev,
        {
          id: itemId,
          name: '',
          price: '0.00',
          userTags: [],
          receiptId: finalReceiptId,
        },
      ]);
    } catch (err) {
      console.error('Failed to add item:', err);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    } finally {
      setIsAddingItem(false);
    }
  };

  const updateReceiptItem = (id: string, updates: Partial<ReceiptItemData>) => {
    receiptItems.setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
    // Persist name/price changes to the database for real group rooms (debounced)
    if (
      isGroupRoom &&
      (updates.name !== undefined || updates.price !== undefined)
    ) {
      clearTimeout(itemUpdateTimers.current[id]);
      itemUpdateTimers.current[id] = setTimeout(() => {
        receiptItems.setItems((latestItems) => {
          const latest = latestItems.find((i) => i.id === id);
          if (!latest) return latestItems;
          const nameToSave =
            updates.name !== undefined ? updates.name : latest.name;
          const priceStr =
            updates.price !== undefined ? updates.price : latest.price;
          const unitPrice = parseFloat(priceStr || '0');
          updateItem(
            id,
            nameToSave,
            isNaN(unitPrice) ? undefined : unitPrice,
          ).catch((err) => {
            console.error(err);
            Alert.alert(
              'Save Failed',
              'Could not save item changes. Please try again.',
            );
          });
          return latestItems; // no state change, just reading
        });
      }, 600);
    }
  };

  const deleteReceiptItem = (id: string) => {
    receiptItems.setItems(receiptItems.items.filter((item) => item.id !== id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (isGroupRoom)
      deleteItem(id).catch((err) => {
        console.error(err);
        Alert.alert(
          'Delete Failed',
          'Could not delete the item. Please refresh and try again.',
        );
      });
  };

  const handleDeleteReceipt = (receiptId: string, sectionItemIds: string[]) => {
    const count = sectionItemIds.length;
    Alert.alert(
      'Delete Receipt',
      `Delete this receipt and its ${count} item${count !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const idSet = new Set(sectionItemIds);
            receiptItems.setItems((prev) =>
              prev.filter((item) => !idSet.has(item.id)),
            );
            setSelectedItemIds((prev) => {
              const next = new Set(prev);
              idSet.forEach((id) => next.delete(id));
              return next;
            });
            if (isGroupRoom)
              deleteReceipt(receiptId).catch((err) => {
                console.error(err);
                Alert.alert(
                  'Delete Failed',
                  'Could not delete the receipt. Please refresh and try again.',
                );
              });
          },
        },
      ],
    );
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
    if (isGroupRoom) {
      const profileId = groupDisplay.participantIdToProfileId.get(userId);
      if (profileId)
        unassignItem(itemId, profileId).catch((err) => {
          console.error(err);
          Alert.alert(
            'Error',
            'Failed to remove item assignment. Please refresh and try again.',
          );
        });
    }
  };

  /**---------------- Computed Values ---------------- */
  const getParticipantItemCount = (participantId: number) => {
    return receiptItems.items.filter((item) =>
      item.userTags?.includes(participantId),
    ).length;
  };

  const getParticipantTotal = (participantId: number) => {
    const participantItems = receiptItems.items.filter((item) =>
      item.userTags?.includes(participantId),
    );
    const subtotal = participantItems.reduce((sum, item) => {
      const price = parseFloat(item.price || '0');
      const discount = parseFloat(item.discount || '0');
      const claimCount = item.userTags?.length || 1;
      return sum + (price - discount) / claimCount;
    }, 0);
    const tax = participantItems.reduce((sum, item) => {
      const rid = item.receiptId ?? null;
      if (!rid || !taxPerItemMap.has(rid)) return sum;
      const claimCount = item.userTags?.length || 1;
      return sum + taxPerItemMap.get(rid)! / claimCount;
    }, 0);
    const total = subtotal + tax;
    if (total > 100000) {
      return '100,000.00+';
    }
    return total.toFixed(2);
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
        <View className='w-[14vw] h-[2vh]' />
      </View>

      {/* ── Group name (group rooms only) ── */}
      {isGroupRoom && (
        <View className='items-center px-16 pb-1' pointerEvents='box-none'>
          {isEditingGroupName ? (
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              returnKeyType='done'
              onSubmitEditing={() => {
                setIsEditingGroupName(false);
                const trimmed = groupName.trim();
                if (trimmed)
                  updateGroupName(roomId, trimmed).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Save Failed',
                      'Could not save the group name. Please try again.',
                    );
                  });
              }}
              onBlur={() => {
                setIsEditingGroupName(false);
                const trimmed = groupName.trim();
                if (trimmed)
                  updateGroupName(roomId, trimmed).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Save Failed',
                      'Could not save the group name. Please try again.',
                    );
                  });
              }}
              className='text-foreground text-base font-bold text-center border-b border-border'
              style={{ minWidth: 80 }}
              numberOfLines={1}
            />
          ) : (
            <Pressable
              className='flex-row items-center gap-1'
              onPress={() => setIsEditingGroupName(true)}
            >
              <Text
                className='text-foreground text-base font-bold'
                numberOfLines={1}
              >
                {groupName || 'Group'}
              </Text>
              <MaterialCommunityIcons
                name='pencil-outline'
                size={14}
                className='text-muted-foreground'
              />
            </Pressable>
          )}
        </View>
      )}

      {/* ── Body content ── */}
      <View className='flex-1'>
        {/* Middle part - scrollable receipt items */}
        <Animated.ScrollView
          className='p-4 flex-1'
          contentContainerClassName='min-w-full self-center z-[1]'
          scrollEnabled={!dragState.isDragging}
          ref={scrollCtx.scrollViewRef}
          onScroll={scrollCtx.trackScrollOffset}
          scrollEventThrottle={16}
          onContentSizeChange={scrollCtx.onContentSizeChange}
          contentContainerStyle={{ paddingBottom: scrollCtx.bottomPadding }}
          refreshControl={
            isGroupRoom ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
              />
            ) : undefined
          }
        >
          <View className='gap-2'>
            {itemSections.map(
              ({ receiptId, items: sectionItems }, sectionIndex) => (
                <React.Fragment key={receiptId ?? '__no_receipt__'}>
                  {isGroupRoom && (
                    <View className='flex-row items-center justify-between px-1 pt-1'>
                      <Text className='text-muted-foreground text-xs font-semibold uppercase tracking-wide'>
                        {receiptId
                          ? (() => {
                              const r = groupData.receipts.find(
                                (rec) => rec.id === receiptId,
                              );
                              const byLine = r?.is_manual
                                ? `Created by ${receiptUploaderMap.get(receiptId) ?? 'Unknown'}`
                                : `Uploaded by ${receiptUploaderMap.get(receiptId) ?? 'Unknown'}`;
                              return `Receipt #${sectionIndex + 1} · ${byLine}`;
                            })()
                          : 'No Receipt'}
                      </Text>
                      {isEditMode && receiptId && (
                        <Pressable
                          onPress={() =>
                            handleDeleteReceipt(
                              receiptId,
                              sectionItems.map((i) => i.id),
                            )
                          }
                          className='active:opacity-50 p-1'
                        >
                          <MaterialCommunityIcons
                            name='trash-can-outline'
                            size={16}
                            color='#ef4444'
                          />
                        </Pressable>
                      )}
                    </View>
                  )}
                  {sectionItems.map((item) => (
                    <ReceiptItem
                      key={item.id}
                      item={item}
                      onUpdate={(updates) =>
                        updateReceiptItem(item.id, updates)
                      }
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
                      bannerTranslation={bannerTranslation}
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
                      editModeAnim={editModeAnim}
                      isSelected={selectedItemIds.has(item.id)}
                      onToggleSelect={() => toggleItemSelection(item.id)}
                      scrollContext={scrollCtx}
                    />
                  ))}
                  {/* Tax row — displayed at the bottom of each receipt section */}
                  {isGroupRoom && receiptId && receiptTaxMap.has(receiptId) && (
                    <View className='flex-row items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border opacity-70'>
                      <View className='flex-row items-center gap-2'>
                        <MaterialCommunityIcons
                          name='percent-outline'
                          size={16}
                          color='#6b7280'
                        />
                        <Text className='text-muted-foreground text-sm font-medium'>
                          Tax
                        </Text>
                      </View>
                      <Text className='text-muted-foreground text-sm font-semibold'>
                        ${receiptTaxMap.get(receiptId)!.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </React.Fragment>
              ),
            )}
            <Animated.View
              style={{ opacity: editModeAnim }}
              pointerEvents={isEditMode ? 'auto' : 'none'}
            >
              <Pressable
                className='bg-card rounded-2xl border border-border w-full py-4 items-center justify-center active:opacity-70 flex-row gap-2'
                onPress={handleAddReceiptItem}
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
            </Animated.View>
          </View>
        </Animated.ScrollView>

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
                        roomId,
                        items: JSON.stringify(
                          displayItems.filter((item) =>
                            item.userTags?.includes(participant.id),
                          ),
                        ),
                        participantId: participant.id.toString(),
                        participantName: participant.name,
                        profileId:
                          groupDisplay.participantIdToProfileId.get(
                            participant.id,
                          ) ?? '',
                        taxPerItem: JSON.stringify(
                          Object.fromEntries(taxPerItemMap),
                        ),
                      } as YourItemsRoomParams,
                    });
                  }
                }}
                isEditMode={isEditMode}
                onRename={
                  isGroupRoom
                    ? // In a group room: only the current user can rename themselves
                      groupDisplay.participantIdToProfileId.get(
                        participant.id,
                      ) === currentUserId
                      ? (newName) =>
                          updateUsername(newName).catch((err) => {
                            console.error(err);
                            Alert.alert(
                              'Save Failed',
                              'Could not update your username. Please try again.',
                            );
                          })
                      : undefined
                    : // In a local room: anyone can be renamed
                      (newName) => renameParticipant(participant.id, newName)
                }
              />
            ))}

            {/* Add participant button - hidden when at the 10-person limit */}
            {displayParticipants.length < 10 && (
              <Pressable
                className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10'
                style={{ width: 160, height: 100 }}
                onPress={() => setShowAddOptions(true)}
              >
                <View className='h-3 bg-accent-light' />
                <View className='flex-1 items-center justify-center'>
                  <MaterialCommunityIcons
                    name='plus'
                    size={32}
                    className='text-accent'
                  />
                </View>
              </Pressable>
            )}
          </ScrollView>

          {/* Drop to Claim - absolutely positioned, slides up during drag, never affects layout or touch */}
          <Animated.View
            pointerEvents='none'
            style={{
              position: 'absolute',
              bottom: -12,
              left: 0,
              right: 0,
              alignItems: 'center',
              opacity: dropToClaimOpacity,
              transform: [{ translateY: dropToClaimAnim }],
            }}
          >
            <Text className='text-accent text-center text-sm py-1'>
              {displayParticipants.length === 0
                ? 'Add participants first'
                : 'Drop to Claim'}
            </Text>
          </Animated.View>
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
          disabled={showQuickActions || isEditAnimating}
          onPress={() => {
            const newMode = !isEditMode;
            setIsEditAnimating(true);
            setIsEditMode(newMode);
            Animated.timing(editModeAnim, {
              toValue: newMode ? 1 : 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => setIsEditAnimating(false));
          }}
        >
          <View style={{ width: 26, height: 26 }}>
            <Animated.View
              style={{ position: 'absolute', opacity: editModeAnim }}
            >
              <MaterialCommunityIcons name='check' size={26} color='#ffffff' />
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: editModeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              }}
            >
              <MaterialCommunityIcons
                name='pencil-outline'
                size={26}
                color='#4999DF'
              />
            </Animated.View>
          </View>
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
        className='absolute right-4 flex-row items-center gap-2'
        style={{ zIndex: 30, top: insets.top + 8 }}
      >
        {/* Complete button — visible only when all items are assigned */}
        {allItemsAssigned && !showQuickActions && (
          <Pressable
            className='bg-primary px-3 h-[14vw] rounded-2xl items-center justify-center shadow-md shadow-black/20 active:opacity-70'
            onPress={() =>
              router.push({ pathname: '/room-summary', params: { roomId } })
            }
          >
            <Text className='text-primary-foreground font-semibold text-sm'>
              Complete
            </Text>
          </Pressable>
        )}

        {/* Three-dots button + dropdown */}
        <View>
          <Pressable
            className='absolute top-0 right-0'
            style={{ width: 280, zIndex: 1 }}
            pointerEvents={showQuickActions ? 'auto' : 'none'}
          >
            <Animated.View style={{ opacity: dropdownOpacity }}>
              <View className='bg-card border border-border rounded-[25px] shadow-lg shadow-black/30 overflow-hidden'>
                {/* Top row of icon buttons */}
                <View className='flex-row items-center justify-around py-3 px-4'>
                  <Pressable
                    className='items-center gap-1'
                    onPress={() => {
                      setShowQuickActions(false);
                      router.push({
                        pathname: '/add-receipt',
                        params: { groupId: roomId },
                      });
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
                    Claim for All Selected Items
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
                    Unclaim for All Selected Items
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
          <Animated.View
            style={{
              opacity: dropdownOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}
            pointerEvents='box-none'
          >
            <IconButton
              icon='dots-horizontal'
              bgClassName='bg-card shadow-md shadow-black/20'
              iconClassName='text-accent-dark'
              pressEffect='fade'
              onPress={() => setShowQuickActions((prev) => !prev)}
            />
          </Animated.View>
        </View>
      </View>

      {/* Drag overlay - "Claim N items" indicator */}
      {bannerVisibleState && bannerInitialPosRef.current && (
        <Reanimated.View
          style={[
            {
              position: 'absolute',
              zIndex: 9999,
              elevation: 9999,
              top: bannerInitialPosRef.current.y - 40,
              left: bannerInitialPosRef.current.x - 20,
            },
            bannerAnimStyle,
          ]}
          pointerEvents='none'
        >
          <View className='bg-primary rounded-2xl px-4 py-4 h-[6vh] w-[45vw] shadow-lg shadow-black/30'>
            <Text className='text-primary-foreground font-bold text-lg text-right'>
              Claim {bannerItemCountRef.current}{' '}
              {bannerItemCountRef.current === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </Reanimated.View>
      )}

      <AddParticipantSheet
        visible={showAddOptions}
        onClose={() => setShowAddOptions(false)}
        onShareSMS={handleShareSMS}
        onAddManually={handleAddManually}
      />

      <AddParticipantManualModal
        visible={showAddManual}
        onClose={() => setShowAddManual(false)}
        onAdd={(name) => addParticipant(name)}
        addedParticipants={
          isGroupRoom ? groupDisplay.participants : participants
        }
        lockedParticipantIds={
          isGroupRoom ? groupDisplay.participants.map((p) => p.id) : []
        }
        onRenameParticipant={isGroupRoom ? undefined : renameParticipant}
        onRemoveParticipant={isGroupRoom ? undefined : removeParticipant}
      />

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

      {pendingConfidence && (
        <ReceiptConfidenceModal
          visible={showConfidenceModal}
          onClose={() => {
            setShowConfidenceModal(false);
            setPendingConfidence(null);
          }}
          data={pendingConfidence}
        />
      )}

      {/* Add Item Receipt Picker Sheet */}
      <Modal
        visible={showAddItemSheet}
        transparent
        animationType='slide'
        onRequestClose={() => setShowAddItemSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            onPress={() => setShowAddItemSheet(false)}
          />
          <View
            className='bg-background border-t border-border rounded-t-3xl'
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <View className='items-center py-3'>
              <View className='w-10 h-1 rounded-full bg-border' />
            </View>
            <Text className='text-foreground text-base font-bold px-4 pb-3'>
              Add to Receipt
            </Text>
            <ScrollView
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps='handled'
            >
              {/* No receipt option */}
              <Pressable
                onPress={() => {
                  setAddItemReceiptChoice(null);
                  setAddItemTax('');
                }}
                className='flex-row items-center gap-3 px-4 py-3 border-b border-border active:opacity-70'
              >
                <MaterialCommunityIcons
                  name={
                    addItemReceiptChoice === null
                      ? 'radiobox-marked'
                      : 'radiobox-blank'
                  }
                  size={20}
                  color={addItemReceiptChoice === null ? '#4999DF' : '#9ca3af'}
                />
                <Text className='text-foreground flex-1'>
                  No receipt (uncategorized)
                </Text>
              </Pressable>

              {/* Existing receipts */}
              {groupData.receipts.map((r, i) => {
                const label = `Receipt #${i + 1}`;
                const byLine = r.is_manual
                  ? `Created by ${receiptUploaderMap.get(r.id) ?? 'Unknown'}`
                  : `Uploaded by ${receiptUploaderMap.get(r.id) ?? 'Unknown'}`;
                const isSelected = addItemReceiptChoice === r.id;
                return (
                  <View key={r.id} className='border-b border-border'>
                    <Pressable
                      onPress={() => {
                        setAddItemReceiptChoice(r.id);
                        setAddItemTax(r.tax != null ? String(r.tax) : '');
                      }}
                      className='flex-row items-center gap-3 px-4 py-3 active:opacity-70'
                    >
                      <MaterialCommunityIcons
                        name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={20}
                        color={isSelected ? '#4999DF' : '#9ca3af'}
                      />
                      <View className='flex-1'>
                        <Text className='text-foreground font-medium'>
                          {label}
                        </Text>
                        <Text className='text-muted-foreground text-xs'>
                          {byLine}
                        </Text>
                      </View>
                      {r.tax != null && !isSelected && (
                        <Text className='text-muted-foreground text-xs'>
                          Tax: ${r.tax.toFixed(2)}
                        </Text>
                      )}
                    </Pressable>
                    {isSelected && (
                      <View className='flex-row items-center gap-2 pl-12 pr-4 pb-3'>
                        <Text className='text-muted-foreground text-sm'>
                          Tax ($):
                        </Text>
                        <TextInput
                          value={addItemTax}
                          onChangeText={setAddItemTax}
                          placeholder='0.00'
                          keyboardType='decimal-pad'
                          className='border border-border rounded-lg px-3 py-1 text-foreground text-sm w-24'
                        />
                      </View>
                    )}
                  </View>
                );
              })}

              {/* New manual receipt option */}
              <Pressable
                onPress={() => {
                  setAddItemReceiptChoice('new');
                  setAddItemTax('');
                }}
                className='flex-row items-center gap-3 px-4 py-3 border-b border-border active:opacity-70'
              >
                <MaterialCommunityIcons
                  name={
                    addItemReceiptChoice === 'new'
                      ? 'radiobox-marked'
                      : 'radiobox-blank'
                  }
                  size={20}
                  color={addItemReceiptChoice === 'new' ? '#4999DF' : '#9ca3af'}
                />
                <Text className='text-foreground flex-1'>
                  + New manual receipt
                </Text>
              </Pressable>
              {addItemReceiptChoice === 'new' && (
                <View className='gap-3 px-4 py-3 ml-8'>
                  <View className='flex-row items-center gap-2'>
                    <Text className='text-muted-foreground text-sm'>
                      Tax ($):
                    </Text>
                    <TextInput
                      value={addItemTax}
                      onChangeText={setAddItemTax}
                      placeholder='0.00'
                      keyboardType='decimal-pad'
                      className='border border-border rounded-lg px-3 py-1 text-foreground text-sm w-24'
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View className='flex-row gap-3 px-4 pt-4'>
              <Pressable
                onPress={() => setShowAddItemSheet(false)}
                className='flex-1 bg-card border border-border rounded-xl py-3 items-center active:opacity-70'
              >
                <Text className='text-muted-foreground font-medium'>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmAddItem}
                disabled={isAddingItem}
                className='flex-1 bg-primary rounded-xl py-3 items-center active:opacity-70'
              >
                <Text className='text-primary-foreground font-medium'>
                  {isAddingItem ? 'Adding…' : 'Add Item'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
