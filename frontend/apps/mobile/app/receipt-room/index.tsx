import { ReceiptItem } from '@shared/components/ReceiptItem';
import { ReceiptItemData } from '@shared/types';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  ScrollView,
  LayoutRectangle,
  Animated,
  ActivityIndicator,
  Alert,
  Share,
  Text,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  Image,
  Keyboard,
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
  PriceInput,
  getRoomInviteMessage,
  useScrollToInput,
  calculateParticipantTotal,
} from '@eezy-receipt/shared';
import { USER_COLOR_HEX } from '@shared/constants';
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
  updateReceiptOwner,
  updateGroupName,
  createGuestProfile,
  removeGroupMember,
  createInviteLink,
} from '@/services/groupApi';
import { supabase } from '@/services/supabase';
import { takePendingReceiptPhotos } from '@/services/pendingReceiptPhotos';
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
  isGuest?: boolean;
  accentColor?: string;
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

  /**---------------- Room Finished State ---------------- */
  const [isRoomFinished, setIsRoomFinished] = useState(false);
  const finishedAlertShownRef = useRef(false);

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
  const addItemBackdropAnim = useRef(new Animated.Value(0)).current;
  const addItemSheetAnim = useRef(new Animated.Value(0)).current;

  /**---------------- Text Focus State ---------------- */
  const [isAnyTextFocused, setIsAnyTextFocused] = useState(false);
  const isAnyTextFocusedRef = useRef(false);
  useEffect(() => {
    isAnyTextFocusedRef.current = isAnyTextFocused;
  }, [isAnyTextFocused]);

  // Tracks the number of in-flight claim/unclaim API requests. The Supabase
  // realtime sync is suppressed while this is > 0, so that intermediate
  // refetches (triggered by unrelated events) don't overwrite optimistic state.
  const pendingClaimsRef = useRef(0);

  /**---------------- Undo Toast State ---------------- */
  const [undoToast, setUndoToast] = useState<{
    message: string;
    onUndo: () => void;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUndoActionRef = useRef<(() => void) | null>(null);

  const showUndoToast = (
    message: string,
    undoAction: () => void,
    deferredAction: () => void,
  ) => {
    // Flush any existing deferred action immediately before showing the new toast
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
      pendingUndoActionRef.current?.();
      pendingUndoActionRef.current = null;
    }
    pendingUndoActionRef.current = deferredAction;
    undoTimerRef.current = setTimeout(() => {
      deferredAction();
      pendingUndoActionRef.current = null;
      undoTimerRef.current = null;
      setUndoToast(null);
    }, 5000);
    setUndoToast({
      message,
      onUndo: () => {
        if (undoTimerRef.current !== null) {
          clearTimeout(undoTimerRef.current);
          undoTimerRef.current = null;
        }
        pendingUndoActionRef.current = null;
        undoAction();
        setUndoToast(null);
      },
    });
  };

  /**---------------- Debounce timers for item updates ---------------- */
  const itemUpdateTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  /**---------------- Quick Actions State ---------------- */
  const [showQuickActions, setShowQuickActions] = useState(false);

  /**---------------- Add Participant State ---------------- */
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [pendingGuestNames, setPendingGuestNames] = useState<string[]>([]);

  /**---------------- Receipt Image Viewer State ---------------- */
  const [viewingReceiptImage, setViewingReceiptImage] = useState<string | null>(
    null,
  );
  const [receiptImageLoading, setReceiptImageLoading] = useState(false);
  /** Separate state for viewing a receipt image from within the add-item sheet,
   *  displayed as an overlay inside the same Modal to avoid nested-Modal issues. */
  const [addItemSheetViewingImage, setAddItemSheetViewingImage] = useState<
    string | null
  >(null);

  /**---------------- Receipt Owner Change Loading State ---------------- */
  const [changingOwnerReceiptId, setChangingOwnerReceiptId] = useState<
    string | null
  >(null);

  /**---------------- Add Item Sheet State ---------------- */
  const [showAddItemSheet, setShowAddItemSheet] = useState(false);
  const [addItemReceiptChoice, setAddItemReceiptChoice] = useState<
    string | null
  >(null);
  const [addItemTax, setAddItemTax] = useState('0.00');
  const [addItemName, setAddItemName] = useState('');
  const [addItemPrice, setAddItemPrice] = useState('0.00');

  const [isAddingItem, setIsAddingItem] = useState(false);

  /**---------------- Tax Input State (editable tax rows) ---------------- */
  const [localTaxInputs, setLocalTaxInputs] = useState<Map<string, string>>(
    new Map(),
  );

  // Tracks the tax amount (in $) last saved to the receipt for each item,
  // so repeated price edits correctly update rather than accumulate.
  const itemSavedTaxRef = useRef<Record<string, number>>({});

  // Optimistic local overrides for receipt tax amounts — updated immediately when
  // updateReceiptTax is called so the UI reflects changes before Supabase resyncs.
  const [localReceiptTaxOverrides, setLocalReceiptTaxOverrides] = useState<
    Map<string, number>
  >(new Map());

  /**---------------- OCR on initial photos from create-room ---------------- */
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Receipt IDs we're waiting to see appear in the realtime cache. */
  const pendingReceiptIdsRef = useRef<Set<string>>(new Set());
  /** Queue of confidence reports to show one-by-one after uploads complete. */
  const [confidenceQueue, setConfidenceQueue] = useState<ConfidenceData[]>([]);
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
        // Enqueue all collected confidence reports to show one-by-one.
        if (collectedConfidence.length > 0) {
          setConfidenceQueue((prev) => [...prev, ...collectedConfidence]);
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

  /** Pick up photos handed off by the Add Receipt screen and process them here
   *  so the receipt-room's "Processing receipt…" banner is shown. */
  useFocusEffect(
    useCallback(() => {
      const uris = takePendingReceiptPhotos();
      if (!uris || uris.length === 0 || !params.roomId) return;
      setIsLoadingPhoto(true);
      const collectedConfidence: ConfidenceData[] = [];
      Promise.all(
        uris.map(async (uri) => {
          const result = await addReceipt(params.roomId as string, uri);
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
          if (collectedConfidence.length > 0) {
            setConfidenceQueue((prev) => [...prev, ...collectedConfidence]);
          }
          // Loading cleared by the groupData watcher once receipts arrive.
        })
        .catch((err) => {
          Alert.alert(
            'Upload Failed',
            err instanceof Error ? err.message : 'Could not process receipt.',
          );
          setIsLoadingPhoto(false);
        });

      const fallback = setTimeout(() => {
        if (pendingReceiptIdsRef.current.size > 0) {
          pendingReceiptIdsRef.current = new Set();
          setIsLoadingPhoto(false);
        }
      }, 20_000);
      return () => clearTimeout(fallback);
    }, [params.roomId]),
  );

  /**---------------- Participants Functions ---------------- */
  const addParticipant = (name: string) => {
    if (participants.length >= 10) return;
    const maxID =
      participants.length > 0 ? Math.max(...participants.map((p) => p.id)) : 0;
    const newID = maxID + 1;
    setParticipants((prev) => [...prev, { id: newID, name }]);
  };

  const addGuestParticipant = async (name: string) => {
    if (!isGroupRoom) {
      addParticipant(name);
      return;
    }
    setPendingGuestNames((prev) => [...prev, name]);
    try {
      await createGuestProfile(roomId, name);
      await groupData.refetch();
      // Pending name is cleared by the useEffect below once the participant
      // appears in groupDisplay.participants, preventing a flash of absence.
    } catch (err) {
      setPendingGuestNames((prev) => prev.filter((n) => n !== name));
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not add guest participant.',
      );
    }
  };

  const handleShareSMS = async () => {
    try {
      let inviteUrl = '';
      try {
        const { url } = await createInviteLink(roomId);
        inviteUrl = url;
      } catch {
        inviteUrl = `${process.env.EXPO_PUBLIC_FRONTEND_URL ?? 'https://receipt-divider.vercel.app'}/join?roomId=${roomId}`;
      }
      const message = getRoomInviteMessage(roomId, groupName, inviteUrl);
      await Share.share({ message });
      setShowAddOptions(false);
    } catch (error) {
      console.error('Share error:', error);
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
    if (isGroupRoom && !isHost) {
      const targetProfileId =
        groupDisplay.participantIdToProfileId.get(participantId);
      if (targetProfileId !== currentUserId) {
        Alert.alert(
          'Permission Denied',
          'You can only claim items for yourself. Only the host can claim/unclaim items for other people.',
        );
        return;
      }
    }
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
    // Fire backend assign/unassign call(s) when in a real group — bulk when >1 item selected
    if (isGroupRoom) {
      const profileId =
        groupDisplay.participantIdToProfileId.get(participantId);
      if (profileId) {
        const ids = [...selectedItemIds];
        pendingClaimsRef.current++;
        const req = allAlreadyClaimed
          ? ids.length === 1
            ? unassignItem(ids[0], profileId)
            : unassignItems(ids, profileId)
          : ids.length === 1
            ? assignItem(ids[0], profileId)
            : assignItems(ids, profileId);
        req
          .catch((err) => {
            receiptItems.setItems(itemsSnapshot);
            Alert.alert(
              'Error',
              `Failed to ${allAlreadyClaimed ? 'unassign' : 'assign'} item. Changes have been reverted.`,
            );
            console.error(err);
          })
          .finally(() => {
            pendingClaimsRef.current--;
          });
      }
    }
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
        .select('name, is_finished')
        .eq('id', roomId)
        .single();
      setGroupName(data?.name ?? '');
      if (data?.is_finished) setIsRoomFinished(true);
    })();
  }, [roomId, isGroupRoom, currentUserId]);

  // Navigate back with an error alert if the initial group data fetch fails
  useEffect(() => {
    if (!isGroupRoom || !groupData.hasError) return;
    router.back();
    Alert.alert(
      'Connection Error',
      'Could not load the room. Please check your connection and try again.',
    );
  }, [isGroupRoom, groupData.hasError]);

  // Navigate back with a timeout alert if data never arrives
  useEffect(() => {
    if (!isGroupRoom || groupData.isLoaded) return;
    const timer = setTimeout(() => {
      router.back();
      Alert.alert(
        'Connection Timed Out',
        'The room took too long to load. Please check your connection and try again.',
      );
    }, 15_000);
    return () => clearTimeout(timer);
  }, [isGroupRoom, groupData.isLoaded]);

  // Alert all members (including the host) when the room has been completed
  useEffect(() => {
    if (!isRoomFinished || finishedAlertShownRef.current) return;
    if (!groupData.isLoaded) return;
    finishedAlertShownRef.current = true;
    if (isHost) {
      Alert.alert(
        'Room Completed',
        'This room has been marked as completed. Editing items or receipts now is not recommended — any changes will require you to manually re-request payments from members.',
        [{ text: 'OK' }],
      );
    } else {
      Alert.alert(
        'Room Completed',
        'The host has completed this room. You can no longer add or remove items or receipts.',
        [{ text: 'OK' }],
      );
    }
  }, [isRoomFinished, isHost, groupData.isLoaded]);

  // Realtime subscription: detect when the host finishes the room
  useEffect(() => {
    if (!isGroupRoom || !roomId) return;
    const channel = supabase
      .channel(`groups-finished:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newData = payload.new as Record<string, unknown>;
          if (newData.is_finished === true) {
            setIsRoomFinished(true);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isGroupRoom, roomId]);

  // Exit edit mode for non-hosts when the room is completed
  useEffect(() => {
    if (!isRoomFinished || isHost || !isEditMode) return;
    setIsEditMode(false);
    Animated.timing(editModeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsEditAnimating(false));
  }, [isRoomFinished, isHost, isEditMode, editModeAnim]);

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
    // First pass: collect explicit accent colors from profiles
    const rawParticipants = members.map((m, i) => ({
      id: i + 1,
      name: groupData.profiles[m.profile_id]?.username ?? `Member ${i + 1}`,
      isGuest: groupData.profiles[m.profile_id]?.isGuest ?? false,
      accentColor: groupData.profiles[m.profile_id]?.accentColor || null,
    }));
    // Second pass: for members without an explicit color, assign a unique
    // fallback from USER_COLOR_HEX that isn't already taken by someone whose
    // color IS set — this prevents two cards from showing the same color
    // (e.g. a non-host who picked #3b82f6 and a host whose fallback is also
    // bg-avatar-1 = #3b82f6).
    const usedColors = new Set(
      rawParticipants.filter((p) => p.accentColor).map((p) => p.accentColor),
    );
    let colorCursor = 0;
    const participants: ParticipantType[] = rawParticipants.map((p) => {
      if (p.accentColor) return p as ParticipantType;
      while (
        usedColors.has(USER_COLOR_HEX[colorCursor % USER_COLOR_HEX.length])
      ) {
        colorCursor++;
      }
      const fallback = USER_COLOR_HEX[colorCursor % USER_COLOR_HEX.length];
      usedColors.add(fallback);
      colorCursor++;
      return { ...p, accentColor: fallback } as ParticipantType;
    });
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
  // Sync is paused while a TextInput is focused or a claim/unclaim op is in-flight,
  // so intermediate refetches don't overwrite optimistic state.
  useEffect(() => {
    if (
      !isGroupRoom ||
      isAnyTextFocusedRef.current ||
      pendingClaimsRef.current > 0
    )
      return;
    receiptItems.setItems(groupDisplay.items);
  }, [groupDisplay.items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear pending guest names once they actually appear in groupDisplay.participants.
  // This ensures the loading pill stays visible until the real pill is ready.
  useEffect(() => {
    if (pendingGuestNames.length === 0) return;
    const participantNames = new Set(
      groupDisplay.participants.map((p) => p.name),
    );
    setPendingGuestNames((prev) =>
      prev.filter((n) => !participantNames.has(n)),
    );
  }, [groupDisplay.participants]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the loading overlay once all uploaded receipts have arrived in the cache.
  useEffect(() => {
    if (!isLoadingPhoto || pendingReceiptIdsRef.current.size === 0) return;
    const allArrived = [...pendingReceiptIdsRef.current].every((rid) =>
      groupData.receipts.some((r) => r.id === rid),
    );
    if (allArrived) {
      pendingReceiptIdsRef.current = new Set();
      setIsLoadingPhoto(false);
    }
  }, [groupData.receipts, isLoadingPhoto]);

  // Open the confidence modal whenever the queue gains a new entry and no modal is open.
  useEffect(() => {
    if (confidenceQueue.length > 0 && !showConfidenceModal) {
      setShowConfidenceModal(true);
    }
  }, [confidenceQueue, showConfidenceModal]);

  const displayItems = receiptItems.items;
  const displayParticipants = isGroupRoom
    ? groupDisplay.participants
    : participants;

  // Map participant id → hex accent color (for coloring Participant cards and UserTag badges)
  const participantColors = useMemo<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const p of displayParticipants) {
      if (p.accentColor) m[p.id] = p.accentColor;
    }
    return m;
  }, [displayParticipants]);

  // Numeric participant ID for the current user (used when navigating to QR page)
  const currentParticipantId = isGroupRoom
    ? ([...groupDisplay.participantIdToProfileId.entries()].find(
        ([, pid]) => pid === currentUserId,
      )?.[0] ?? 0)
    : 0;

  // Map receipt id → uploader display name (only meaningful in group rooms)
  const receiptUploaderMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of groupData.receipts) {
      const name = groupData.profiles[r.created_by]?.username ?? 'Someone';
      m.set(r.id, r.created_by === currentUserId ? 'You' : name);
    }
    return m;
  }, [groupData.receipts, groupData.profiles, currentUserId]);

  // Stable receipt numbers based on groupData.receipts order — used in both the
  // room section headers and the add-item picker so they always match.
  const receiptNumberMap = useMemo(() => {
    const m = new Map<string, number>();
    groupData.receipts.forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [groupData.receipts]);

  // Map receipt id → tax amount (null/0 if not present), with local optimistic overrides applied
  const receiptTaxMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of groupData.receipts) {
      if (r.tax != null) m.set(r.id, r.tax);
    }
    // Apply optimistic overrides from local state (set before Supabase resyncs)
    for (const [rid, tax] of localReceiptTaxOverrides.entries()) {
      m.set(rid, tax);
    }
    return m;
  }, [groupData.receipts, localReceiptTaxOverrides]);

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

  // Group display items by receipt id, ordered by groupData.receipts (so
  // Receipt #1 always renders before Receipt #2, etc.). Uncategorized items
  // (null receiptId) are placed at the end.
  const itemSections = useMemo(() => {
    if (!isGroupRoom)
      return [{ receiptId: null as string | null, items: displayItems }];
    const map = new Map<string | null, ReceiptItemData[]>();
    for (const item of displayItems) {
      const rid = item.receiptId ?? null;
      if (!map.has(rid)) map.set(rid, []);
      map.get(rid)!.push(item);
    }
    // Build order: receipts in their canonical order, then null (uncategorized)
    const order: (string | null)[] = groupData.receipts
      .map((r) => r.id)
      .filter((id) => map.has(id));
    if (map.has(null)) order.push(null);
    return order.map((rid) => ({ receiptId: rid, items: map.get(rid)! }));
  }, [isGroupRoom, displayItems, groupData.receipts]);

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
        pendingClaimsRef.current++;
        (ids.length === 1
          ? assignItem(ids[0], profileId)
          : assignItems(ids, profileId)
        )
          .catch((err) => {
            console.error(err);
            if (!claimAlertShown) {
              claimAlertShown = true;
              Alert.alert('Error', 'Failed to claim items. Please try again.');
            }
          })
          .finally(() => {
            pendingClaimsRef.current--;
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
        pendingClaimsRef.current++;
        (ids.length === 1
          ? unassignItem(ids[0], profileId)
          : unassignItems(ids, profileId)
        )
          .catch((err) => {
            console.error(err);
            if (!unclaimAlertShown) {
              unclaimAlertShown = true;
              Alert.alert(
                'Error',
                'Failed to unclaim items. Please try again.',
              );
            }
          })
          .finally(() => {
            pendingClaimsRef.current--;
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
    if (!isHost && isRoomFinished) {
      Alert.alert(
        'Room Completed',
        'The host has completed this room. No changes can be made.',
      );
      return;
    }
    setAddItemName('');
    setAddItemPrice('0.00');
    setAddItemTax('0.00');
    setAddItemReceiptChoice(
      groupData.receipts.length > 0 ? groupData.receipts[0].id : 'new',
    );
    addItemBackdropAnim.setValue(0);
    addItemSheetAnim.setValue(0);
    setShowAddItemSheet(true);
    Animated.parallel([
      Animated.timing(addItemBackdropAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(addItemSheetAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const dismissAddItemSheet = () => {
    Animated.parallel([
      Animated.timing(addItemBackdropAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(addItemSheetAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAddItemSheet(false);
      setAddItemSheetViewingImage(null);
    });
  };

  const confirmAddItem = async () => {
    if (isGroupRoom && !isHost && isRoomFinished) {
      dismissAddItemSheet();
      Alert.alert(
        'Room Completed',
        'The host has completed this room. No changes can be made.',
      );
      return;
    }
    setIsAddingItem(true);
    try {
      let finalReceiptId: string | null = null;
      // taxValue is a percentage (e.g. 8.5 means 8.5%)
      const taxPctValue = parseFloat(addItemTax);
      const hasTaxPct = !isNaN(taxPctValue) && taxPctValue > 0;
      if (addItemReceiptChoice === 'new') {
        const { receiptId } = await createManualReceipt(roomId, null);
        finalReceiptId = receiptId;
      } else if (addItemReceiptChoice !== null) {
        finalReceiptId = addItemReceiptChoice;
      }
      const parsedPrice = parseFloat(addItemPrice) || 0;
      const { itemId } = await addItem(
        roomId,
        finalReceiptId,
        addItemName,
        parsedPrice,
      );
      // If the item has a price and a tax rate, update the receipt's tax amount now.
      if (hasTaxPct && parsedPrice > 0 && finalReceiptId) {
        const newItemTax =
          Math.round(parsedPrice * (taxPctValue / 100) * 100) / 100;
        const receiptCurrentTax = receiptTaxMap.get(finalReceiptId) ?? 0;
        const updatedReceiptTax =
          Math.round((receiptCurrentTax + newItemTax) * 100) / 100;
        itemSavedTaxRef.current[itemId] = newItemTax;
        setLocalReceiptTaxOverrides((prev) => {
          const next = new Map(prev);
          next.set(finalReceiptId!, updatedReceiptTax);
          return next;
        });
        await updateReceiptTax(finalReceiptId, updatedReceiptTax).catch(
          (err) => {
            console.error('Failed to update receipt tax:', err);
          },
        );
      }
      receiptItems.setItems((prev) => [
        ...prev,
        {
          id: itemId,
          name: addItemName,
          price: parsedPrice > 0 ? parsedPrice.toFixed(2) : '0.00',
          userTags: [],
          receiptId: finalReceiptId,
          taxPct: hasTaxPct ? taxPctValue : undefined,
        },
      ]);
      dismissAddItemSheet();
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
          // If this item has a tax percentage and a receipt, update the receipt's
          // tax amount: remove the old contribution and add the new one.
          if (
            updates.price !== undefined &&
            latest.taxPct != null &&
            latest.taxPct > 0 &&
            latest.receiptId
          ) {
            const newItemTax =
              Math.round(unitPrice * (latest.taxPct / 100) * 100) / 100;
            const prevItemTax = itemSavedTaxRef.current[id] ?? 0;
            const receiptCurrentTax = receiptTaxMap.get(latest.receiptId) ?? 0;
            const updatedReceiptTax =
              Math.round((receiptCurrentTax - prevItemTax + newItemTax) * 100) /
              100;
            itemSavedTaxRef.current[id] = newItemTax;
            setLocalReceiptTaxOverrides((prev) => {
              const next = new Map(prev);
              next.set(latest.receiptId!, updatedReceiptTax);
              return next;
            });
            updateReceiptTax(latest.receiptId, updatedReceiptTax).catch(
              (err) => {
                console.error(err);
              },
            );
          }
          return latestItems; // no state change, just reading
        });
      }, 600);
    }
  };

  const deleteReceiptItem = (id: string) => {
    if (isGroupRoom && !isHost && isRoomFinished) {
      Alert.alert(
        'Room Completed',
        'The host has completed this room. No changes can be made.',
      );
      return;
    }
    const items = receiptItems.items;
    const idx = items.findIndex((item) => item.id === id);
    const deletedItem = items[idx];
    if (!deletedItem) return;

    receiptItems.setItems(items.filter((item) => item.id !== id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    showUndoToast(
      `"${deletedItem.name || 'Item'}" deleted`,
      () => {
        receiptItems.setItems((prev) => {
          const next = [...prev];
          next.splice(idx, 0, deletedItem);
          return next;
        });
      },
      () => {
        if (isGroupRoom)
          deleteItem(id).catch((err) => {
            console.error(err);
            Alert.alert(
              'Delete Failed',
              'Could not delete the item. Please refresh and try again.',
            );
          });
      },
    );
  };

  const handleDeleteReceipt = (receiptId: string, sectionItemIds: string[]) => {
    if (isGroupRoom && !isHost && isRoomFinished) {
      Alert.alert(
        'Room Completed',
        'The host has completed this room. No changes can be made.',
      );
      return;
    }
    const count = sectionItemIds.length;
    Alert.alert(
      'Delete Receipt',
      `Delete this receipt and its ${count} item${count !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const idSet = new Set(sectionItemIds);
            const allItems = receiptItems.items;
            const deletedItems = allItems.filter((item) => idSet.has(item.id));
            const deletedIndices = deletedItems.map((item) =>
              allItems.indexOf(item),
            );

            receiptItems.setItems((prev) =>
              prev.filter((item) => !idSet.has(item.id)),
            );
            setSelectedItemIds((prev) => {
              const next = new Set(prev);
              idSet.forEach((id) => next.delete(id));
              return next;
            });

            showUndoToast(
              `Receipt and ${count} item${count !== 1 ? 's' : ''} deleted`,
              () => {
                receiptItems.setItems((prev) => {
                  const next = [...prev];
                  deletedItems.forEach((item, i) => {
                    next.splice(deletedIndices[i], 0, item);
                  });
                  return next;
                });
              },
              () => {
                if (isGroupRoom)
                  deleteReceipt(receiptId).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Delete Failed',
                      'Could not delete the receipt. Please refresh and try again.',
                    );
                  });
              },
            );
          },
        },
      ],
    );
  };

  const handleChangeReceiptOwner = (receiptId: string) => {
    const receipt = groupData.receipts.find((r) => r.id === receiptId);
    if (!receipt) return;
    const memberOptions = groupDisplay.participants
      .map((p) => ({
        name: p.name,
        profileId: groupDisplay.participantIdToProfileId.get(p.id) ?? '',
      }))
      .filter((o) => o.profileId);
    Alert.alert('Change Receipt Owner', 'Who should own this receipt?', [
      ...memberOptions.map((o) => ({
        text: o.profileId === receipt.created_by ? `${o.name} ✓` : o.name,
        onPress: () => {
          if (o.profileId === receipt.created_by) return;
          setChangingOwnerReceiptId(receiptId);
          updateReceiptOwner(receiptId, o.profileId)
            .then(() => groupData.refetch())
            .catch((err) => {
              Alert.alert(
                'Error',
                err instanceof Error
                  ? err.message
                  : 'Could not change receipt owner.',
              );
            })
            .finally(() => setChangingOwnerReceiptId(null));
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeItemFromUser = (itemId: string, userId: number) => {
    if (isGroupRoom && !isHost) {
      const targetProfileId = groupDisplay.participantIdToProfileId.get(userId);
      if (targetProfileId !== currentUserId) {
        Alert.alert(
          'Permission Denied',
          'You can only unclaim your own items. Only the host can claim/unclaim items for other people.',
        );
        return;
      }
    }
    const itemsSnapshot = receiptItems.items;
    receiptItems.setItems(
      itemsSnapshot.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            userTags: item.userTags?.filter((tag) => tag !== userId),
          };
        }
        return item;
      }),
    );
    if (isGroupRoom) pendingClaimsRef.current++;

    showUndoToast(
      'User removed from item',
      () => {
        receiptItems.setItems(itemsSnapshot);
        if (isGroupRoom) pendingClaimsRef.current--;
      },
      () => {
        if (isGroupRoom) {
          const profileId = groupDisplay.participantIdToProfileId.get(userId);
          if (profileId) {
            unassignItem(itemId, profileId)
              .catch((err) => {
                console.error(err);
                Alert.alert(
                  'Error',
                  'Failed to remove item assignment. Please refresh and try again.',
                );
              })
              .finally(() => {
                pendingClaimsRef.current--;
              });
          } else {
            pendingClaimsRef.current--;
          }
        }
      },
    );
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
    const { total } = calculateParticipantTotal(
      participantId,
      participantItems,
      taxPerItemMap,
    );
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
          {isHost && isEditingGroupName ? (
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
              returnKeyType='done'
              onEndEditing={(e) => {
                const trimmed = e.nativeEvent.text.trim();
                setIsEditingGroupName(false);
                if (trimmed) {
                  setGroupName(trimmed);
                  updateGroupName(roomId, trimmed).catch((err) => {
                    console.error(err);
                    Alert.alert(
                      'Save Failed',
                      'Could not save the group name. Please try again.',
                    );
                  });
                }
              }}
              className='text-foreground text-base font-bold text-center border-b border-border'
              style={{ minWidth: 80 }}
              numberOfLines={1}
            />
          ) : (
            <Pressable
              className='flex-row items-center gap-1'
              onPress={() => isHost && setIsEditingGroupName(true)}
            >
              <Text
                className='text-foreground text-base font-bold'
                numberOfLines={1}
              >
                {groupName || 'Group'}
              </Text>
              {isHost && (
                <MaterialCommunityIcons
                  name='pencil-outline'
                  size={14}
                  className='text-muted-foreground'
                />
              )}
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
                  {isGroupRoom && receiptId && (
                    <View className='flex-row items-center justify-between px-1 pt-1'>
                      <View className='flex-row items-center flex-1 mr-2 flex-wrap'>
                        {(() => {
                          const r = groupData.receipts.find(
                            (rec) => rec.id === receiptId,
                          );
                          const verb = r?.is_manual
                            ? 'Created by'
                            : 'Uploaded by';
                          const uploaderName =
                            receiptUploaderMap.get(receiptId) ?? 'Unknown';
                          const canChangeOwner =
                            isHost || r?.created_by === currentUserId;
                          return (
                            <>
                              <Text className='text-muted-foreground text-xs font-semibold uppercase tracking-wide'>
                                {`Receipt #${receiptNumberMap.get(receiptId) ?? sectionIndex + 1} · `}
                              </Text>
                              <Pressable
                                disabled={
                                  !canChangeOwner ||
                                  changingOwnerReceiptId === receiptId
                                }
                                onPress={() =>
                                  handleChangeReceiptOwner(receiptId)
                                }
                                className={
                                  canChangeOwner ? 'active:opacity-60' : ''
                                }
                              >
                                <View className='flex-row items-center gap-1'>
                                  {changingOwnerReceiptId === receiptId ? (
                                    <ActivityIndicator
                                      size={10}
                                      color='#4999DF'
                                    />
                                  ) : null}
                                  <Text
                                    className={`text-xs font-semibold uppercase tracking-wide ${canChangeOwner ? 'text-accent' : 'text-muted-foreground'}`}
                                  >
                                    {verb} {uploaderName}
                                  </Text>
                                </View>
                              </Pressable>
                            </>
                          );
                        })()}
                      </View>
                      {isEditMode && receiptId && (
                        <View className='flex-row items-center gap-1'>
                          {(() => {
                            const r = groupData.receipts.find(
                              (rec) => rec.id === receiptId,
                            );
                            return r?.image ? (
                              <Pressable
                                onPress={() => setViewingReceiptImage(r.image)}
                                className='active:opacity-50 mr-2'
                              >
                                <MaterialCommunityIcons
                                  name='image-outline'
                                  size={16}
                                  color='#4999DF'
                                />
                              </Pressable>
                            ) : null;
                          })()}
                          <Pressable
                            onPress={() =>
                              handleDeleteReceipt(
                                receiptId,
                                sectionItems.map((i) => i.id),
                              )
                            }
                            className='active:opacity-50'
                          >
                            <MaterialCommunityIcons
                              name='trash-can-outline'
                              size={16}
                              color='#ef4444'
                            />
                          </Pressable>
                        </View>
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
                      onDragStart={
                        isGroupRoom && !isHost && isRoomFinished
                          ? undefined
                          : (_itemId, initialPosition) =>
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
                      onToggleSelect={
                        isGroupRoom && !isHost && isRoomFinished
                          ? undefined
                          : () => toggleItemSelection(item.id)
                      }
                      scrollContext={scrollCtx}
                      participantColors={participantColors}
                    />
                  ))}
                  {/* Tax row — displayed at the bottom of each receipt section */}
                  {isGroupRoom &&
                    receiptId &&
                    (receiptTaxMap.has(receiptId) ||
                      isEditMode ||
                      !!groupData.receipts.find((r) => r.id === receiptId)
                        ?.is_manual) && (
                      <View
                        className={`flex-row items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border${isEditMode ? '' : ' opacity-70'}`}
                      >
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
                        {isEditMode ? (
                          <View className='flex-row items-center justify-center'>
                            <Text className='text-muted-foreground text-sm font-semibold'>
                              $
                            </Text>
                            <PriceInput
                              value={
                                localTaxInputs.get(receiptId) ??
                                (receiptTaxMap.get(receiptId) ?? 0).toFixed(2)
                              }
                              onValueChange={(val) => {
                                setLocalTaxInputs((prev) => {
                                  const next = new Map(prev);
                                  next.set(receiptId, val);
                                  return next;
                                });
                              }}
                              onBlur={() => {
                                const valStr = localTaxInputs.get(receiptId);
                                if (valStr === undefined) return;
                                const val = parseFloat(valStr) || 0;
                                setLocalReceiptTaxOverrides((prev) => {
                                  const next = new Map(prev);
                                  if (val > 0) next.set(receiptId, val);
                                  else next.delete(receiptId);
                                  return next;
                                });
                                setLocalTaxInputs((prev) => {
                                  const next = new Map(prev);
                                  next.delete(receiptId);
                                  return next;
                                });
                                updateReceiptTax(
                                  receiptId,
                                  val > 0 ? val : null,
                                ).catch((err) => {
                                  console.error(
                                    'Failed to update receipt tax:',
                                    err,
                                  );
                                });
                              }}
                              placeholder='0.00'
                              placeholderTextColor='#9ca3af'
                              className='text-muted-foreground text-sm font-semibold'
                              style={{
                                paddingBottom: 10,
                                includeFontPadding: false,
                                lineHeight: 20,
                                minWidth: 20,
                              }}
                            />
                          </View>
                        ) : (
                          <Text
                            className='text-muted-foreground text-sm font-semibold'
                            style={{ paddingBottom: 10 }}
                          >
                            ${(receiptTaxMap.get(receiptId) ?? 0).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    )}
                </React.Fragment>
              ),
            )}
            {isEditMode && (
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
            )}
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
            {displayParticipants.map((participant) => {
              const isOwn = participant.id === currentParticipantId;
              const isDisabled = isGroupRoom && !isHost && !isOwn;
              const participantProfileId =
                groupDisplay.participantIdToProfileId.get(participant.id);
              const isParticipantHost =
                isGroupRoom &&
                !!groupData.createdBy &&
                participantProfileId === groupData.createdBy;
              return (
                <View
                  key={participant.id}
                  style={isDisabled ? { opacity: 0.4 } : undefined}
                >
                  <Participant
                    id={participant.id}
                    name={participant.name}
                    itemCount={getParticipantItemCount(participant.id)}
                    totalAmount={getParticipantTotal(participant.id)}
                    isGuest={
                      isGroupRoom
                        ? isHost
                          ? (participant.isGuest ?? false)
                          : false
                        : true
                    }
                    accentColor={participant.accentColor}
                    isHostParticipant={isParticipantHost}
                    onRemove={
                      isGroupRoom
                        ? () => {
                            const profileId =
                              groupDisplay.participantIdToProfileId.get(
                                participant.id,
                              );
                            if (!profileId) return;
                            removeGroupMember(roomId, profileId)
                              .then(() => groupData.refetch())
                              .catch((err) => {
                                Alert.alert(
                                  'Error',
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not remove participant.',
                                );
                              });
                          }
                        : () => removeParticipant(participant.id)
                    }
                    onLayout={(layout) => {
                      participantLayouts.current[participant.id] = {
                        ...layout,
                        x: layout.x + scrollOffset,
                      };
                    }}
                    goToYourItemsPage={() => {
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
                          isReadOnly: isDisabled ? 'true' : 'false',
                        } as YourItemsRoomParams,
                      });
                    }}
                    isEditMode={isEditMode}
                  />
                </View>
              );
            })}

            {/* Add participant button - hidden when at the 10-person limit or for non-hosts */}
            {displayParticipants.length < 10 && (!isGroupRoom || isHost) && (
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
        {!(isGroupRoom && !isHost && isRoomFinished) && (
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
                <MaterialCommunityIcons
                  name='check'
                  size={26}
                  color='#ffffff'
                />
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
        )}
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
                <View className='flex-row items-center justify-around py-5 px-4'>
                  {/* Complete Room — host only; navigate to review screen */}
                  {isHost && (
                    <Pressable
                      className='items-center gap-1'
                      onPress={() => {
                        setShowQuickActions(false);
                        if (!allItemsAssigned) {
                          Alert.alert(
                            'Not All Items Claimed',
                            'Every item must be claimed by at least one participant before you can complete the room.',
                            [{ text: 'OK' }],
                          );
                          return;
                        }
                        router.push({
                          pathname: '/room-summary',
                          params: { roomId },
                        });
                      }}
                    >
                      <MaterialCommunityIcons
                        name='check-circle-outline'
                        size={24}
                        color={allItemsAssigned ? '#22c55e' : '#9ca3af'}
                      />
                      <Text
                        className='text-xs items-center text-center'
                        style={{
                          color: allItemsAssigned ? '#22c55e' : '#9ca3af',
                        }}
                      >
                        Complete{'\n'}Room
                      </Text>
                    </Pressable>
                  )}
                  {(!isGroupRoom || isHost || !isRoomFinished) && (
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
                      <Text className='text-foreground text-xs'>
                        Add Receipt{'\n'}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    className='items-center gap-1'
                    onPress={() => {
                      setShowQuickActions(false);
                      router.push(
                        `/qr?roomId=${roomId}&groupName=${encodeURIComponent(groupName)}&currentParticipantId=${currentParticipantId}&participants=${encodeURIComponent(JSON.stringify(displayParticipants))}`,
                      );
                    }}
                  >
                    <MaterialCommunityIcons
                      name='account-multiple-plus-outline'
                      size={24}
                      className='text-accent-dark'
                    />
                    <Text className='text-foreground text-xs'>Share{'\n'}</Text>
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
                    <Text className='text-foreground text-xs'>
                      Settings{'\n'}
                    </Text>
                  </Pressable>
                </View>

                <View className='h-px bg-border' />

                {/* Menu items */}
                {!(isGroupRoom && !isHost && isRoomFinished) && (
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
                )}

                {!(isGroupRoom && !isHost && isRoomFinished) && (
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
                )}

                {isHost && (
                  <>
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
                        Claim Selected Items for All Participants
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
                        Unclaim Selected Items for All Participants
                      </Text>
                    </Pressable>
                  </>
                )}
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
        onShareQR={() => {
          setShowAddOptions(false);
          router.push(
            `/qr?roomId=${roomId}&groupName=${encodeURIComponent(groupName)}&currentParticipantId=${currentParticipantId}&participants=${encodeURIComponent(JSON.stringify(isGroupRoom ? groupDisplay.participants : participants))}`,
          );
        }}
        onAddManually={handleAddManually}
      />

      <AddParticipantManualModal
        visible={showAddManual}
        onClose={() => setShowAddManual(false)}
        onAdd={(name) => {
          void addGuestParticipant(name);
        }}
        addedParticipants={
          isGroupRoom ? groupDisplay.participants : participants
        }
        lockedParticipantIds={
          isGroupRoom ? groupDisplay.participants.map((p) => p.id) : []
        }
        onRenameParticipant={isGroupRoom ? undefined : renameParticipant}
        onRemoveParticipant={isGroupRoom ? undefined : removeParticipant}
        loadingParticipantNames={isGroupRoom ? pendingGuestNames : undefined}
      />

      {/* Undo toast */}
      {undoToast && (
        <View
          className='absolute left-4 right-4 items-stretch'
          style={{ zIndex: 50, bottom: 100 }}
          pointerEvents='box-none'
        >
          <View className='bg-card border border-border rounded-2xl px-4 py-3 flex-row items-center shadow-lg shadow-black/30'>
            <Text
              className='text-foreground text-sm font-medium flex-1'
              numberOfLines={1}
            >
              {undoToast.message}
            </Text>
            <Pressable
              onPress={undoToast.onUndo}
              className='ml-4 active:opacity-60'
            >
              <Text className='text-accent font-bold text-sm'>Undo</Text>
            </Pressable>
          </View>
        </View>
      )}

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

      {confidenceQueue.length > 0 && (
        <ReceiptConfidenceModal
          visible={showConfidenceModal}
          onClose={() => {
            setShowConfidenceModal(false);
            // Remove the front of the queue; the useEffect above will reopen
            // the modal for the next entry (if any) after the close animation.
            setConfidenceQueue((prev) => prev.slice(1));
          }}
          data={confidenceQueue[0]}
        />
      )}

      {/* Receipt Image Viewer */}
      <Modal
        visible={viewingReceiptImage !== null}
        transparent
        animationType='fade'
        onRequestClose={() => setViewingReceiptImage(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => setViewingReceiptImage(null)}
            style={{
              position: 'absolute',
              top: insets.top + 12,
              right: 16,
              zIndex: 10,
              padding: 8,
            }}
          >
            <MaterialCommunityIcons name='close' size={28} color='#ffffff' />
          </Pressable>
          {viewingReceiptImage && (
            <>
              {receiptImageLoading && (
                <ActivityIndicator
                  size='large'
                  color='#ffffff'
                  style={{ position: 'absolute' }}
                />
              )}
              <Image
                source={{ uri: viewingReceiptImage }}
                style={{ width: '100%', height: '85%' }}
                resizeMode='contain'
                onLoadStart={() => setReceiptImageLoading(true)}
                onLoadEnd={() => setReceiptImageLoading(false)}
              />
            </>
          )}
        </View>
      </Modal>

      {/* Add Item Receipt Picker Sheet */}
      <Modal
        visible={showAddItemSheet}
        transparent
        animationType='none'
        onRequestClose={() => {
          /* prevent hardware back from closing */
        }}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              opacity: addItemBackdropAnim,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()} />
          </Animated.View>
          <Animated.View
            className='bg-background border-t border-border rounded-t-3xl'
            // Dismiss keyboard on tap anywhere in the sheet that isn't a TextInput
            onStartShouldSetResponder={() => {
              Keyboard.dismiss();
              return false;
            }}
            style={[
              { paddingBottom: insets.bottom + 64 },
              {
                transform: [
                  {
                    translateY: addItemSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View className='items-center py-3'>
              <View className='w-10 h-1 rounded-full bg-border' />
            </View>
            <Text className='text-foreground text-base font-bold px-4 pb-3'>
              Add to Receipt
            </Text>

            {/* Item name, price, and tax rate — styled like edit-mode item card */}
            <View className='mx-4 mb-3 bg-card rounded-2xl p-4'>
              <View className='flex-row items-center'>
                <TextInput
                  value={addItemName}
                  onChangeText={setAddItemName}
                  placeholder='Item name'
                  placeholderTextColor='#9ca3af'
                  className='text-foreground font-extrabold text-xl flex-1'
                  style={{
                    padding: 0,
                    includeFontPadding: false,
                    lineHeight: 20,
                  }}
                  numberOfLines={1}
                  returnKeyType='next'
                />
                <View className='flex-row items-center ml-2'>
                  <Text className='text-foreground font-extrabold text-xl'>
                    $
                  </Text>
                  <PriceInput
                    value={addItemPrice}
                    onValueChange={setAddItemPrice}
                    placeholder='0.00'
                    placeholderTextColor='#9ca3af'
                    className='text-foreground font-extrabold text-xl'
                    style={{
                      padding: 0,
                      includeFontPadding: false,
                      lineHeight: 20,
                      minWidth: 20,
                    }}
                  />
                </View>
              </View>
              <View className='flex-row items-center mt-3 pt-3 border-t border-border'>
                <Text className='text-muted-foreground font-extrabold text-xl flex-1'>
                  Tax rate
                </Text>
                <View className='flex-row items-center'>
                  <PriceInput
                    value={addItemTax}
                    onValueChange={setAddItemTax}
                    max={100}
                    placeholder='0.00'
                    placeholderTextColor='#9ca3af'
                    className='text-foreground font-extrabold text-xl'
                    style={{
                      padding: 0,
                      includeFontPadding: false,
                      lineHeight: 20,
                      minWidth: 20,
                    }}
                  />
                  <Text className='text-foreground font-extrabold text-xl ml-1'>
                    %
                  </Text>
                </View>
              </View>
            </View>

            <View className='h-px bg-border mx-4 mb-1' />
            <Text className='text-muted-foreground text-xs font-semibold px-4 pb-2 pt-2'>
              Receipt
            </Text>

            <ScrollView
              style={{ maxHeight: 260 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps='handled'
            >
              {/* Existing receipts */}
              {groupData.receipts.map((r) => {
                const label = `Receipt #${receiptNumberMap.get(r.id) ?? '?'}`;
                const byLine = r.is_manual
                  ? `Created by ${receiptUploaderMap.get(r.id) ?? 'Unknown'}`
                  : `Uploaded by ${receiptUploaderMap.get(r.id) ?? 'Unknown'}`;
                const isSelected = addItemReceiptChoice === r.id;
                return (
                  <View key={r.id} className='border-b border-border'>
                    <Pressable
                      onPress={() => {
                        setAddItemReceiptChoice(r.id);
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
                      <View className='items-end gap-0.5'>
                        {r.total != null && r.total > 0 && (
                          <Text className='text-foreground text-xs font-semibold'>
                            ${r.total.toFixed(2)}
                          </Text>
                        )}
                        {r.tax != null && r.tax > 0 && (
                          <Text className='text-muted-foreground text-xs'>
                            Tax ${r.tax.toFixed(2)}
                          </Text>
                        )}
                      </View>
                      {r.image ? (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            setAddItemSheetViewingImage(r.image);
                          }}
                          className='active:opacity-50 p-1 ml-1'
                          hitSlop={8}
                        >
                          <MaterialCommunityIcons
                            name='image-outline'
                            size={18}
                            color='#4999DF'
                          />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}

              {/* New manual receipt option */}
              <Pressable
                onPress={() => {
                  setAddItemReceiptChoice('new');
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
            </ScrollView>

            <View className='flex-row gap-3 px-4 pt-4'>
              <Pressable
                onPress={dismissAddItemSheet}
                disabled={isAddingItem}
                className='flex-1 bg-card border border-border rounded-xl py-3 items-center active:opacity-70'
                style={{ opacity: isAddingItem ? 0.4 : 1 }}
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
                {isAddingItem ? (
                  <ActivityIndicator size='small' color='#ffffff' />
                ) : (
                  <Text className='text-primary-foreground font-medium'>
                    Add Item
                  </Text>
                )}
              </Pressable>
            </View>
          </Animated.View>

          {/* In-sheet image viewer — absolute overlay inside this Modal to avoid nested-Modal issues */}
          {addItemSheetViewingImage ? (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.92)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPress={() => setAddItemSheetViewingImage(null)}
                style={{
                  position: 'absolute',
                  top: insets.top + 12,
                  right: 16,
                  zIndex: 10,
                  padding: 8,
                }}
              >
                <MaterialCommunityIcons
                  name='close'
                  size={28}
                  color='#ffffff'
                />
              </Pressable>
              <Image
                source={{ uri: addItemSheetViewingImage }}
                style={{ width: '100%', height: '85%' }}
                resizeMode='contain'
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
