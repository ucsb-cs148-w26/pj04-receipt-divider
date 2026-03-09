import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Alert,
  LayoutRectangle,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { ReceiptItemData } from '@shared/types';
import { UserTag } from '@shared/components/UserTag';

// Stable styles for TextInputs — prevents formatters from stripping inline objects
// and ensures consistent cross-platform vertical alignment.
const inputStyles = StyleSheet.create({
  name: {
    padding: 0,
    includeFontPadding: false,
    lineHeight: 20, // matches font-size of text-xl, prevents extra height
  },
  price: {
    padding: 0,
    minWidth: 20,
    includeFontPadding: false,
    lineHeight: 20,
  },
});

/** Drag-related props grouped together */
interface DragProps {
  participantLayouts?: Record<number, LayoutRectangle>;
  scrollOffset?: number;
  onDragStart?: (
    itemId?: string,
    initialPosition?: { x: number; y: number },
  ) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDraggingOverlay?: boolean;
  dragPan?: Animated.ValueXY;
  initialPosition?: { x: number; y: number };
  onParticipantBoundsChange?: (isInBounds: boolean) => void;
  isInParticipantBoundsProp?: boolean;
  /** Called when drag ends on a participant; if provided, this handles the claim instead of onUpdate */
  onDropOnParticipant?: (participantId: number) => void;
}

/** Internal drag state */
interface DragState {
  isDragging: boolean;
  isInParticipantBounds: boolean;
  currentPosition: { x: number; y: number };
}

/** Internal UI state */
interface UIState {
  isHovering: boolean;
  newlyAddedTags: Set<number>;
}

interface ReceiptItemProps extends DragProps {
  /** Core item data */
  item: ReceiptItemData;

  /** Item update callbacks */
  onUpdate: (updates: {
    name?: string;
    price?: string;
    discount?: string;
    userTags?: number[];
  }) => void;
  onDelete: () => void;
  onRemoveFromUser: (userId: number) => void;

  /** Function to get current item data (for overlay to get fresh data) */
  getCurrentItemData?: () => ReceiptItemData;

  /** Text focus state from parent */
  isAnyTextFocused?: boolean;
  onTextFocusChange?: (focused: boolean) => void;

  /** Whether the receipt room is in edit mode */
  isEditMode?: boolean;

  /** Whether this item is selected (non-edit mode) */
  isSelected?: boolean;
  /** Called when item is tapped to toggle selection (non-edit mode) */
  onToggleSelect?: () => void;
}

export function ReceiptItem({
  // Core item data
  item,
  // Item update callbacks
  onUpdate,
  onDelete,
  onRemoveFromUser,
  // Drag props
  participantLayouts = {},
  scrollOffset = 0,
  onDragStart,
  onDragEnd,
  isDragging: isDraggingProp,
  isDraggingOverlay,
  dragPan: externalDragPan,
  initialPosition,
  onParticipantBoundsChange,
  isInParticipantBoundsProp,
  onDropOnParticipant,
  // Fresh data getter for overlay
  getCurrentItemData,
  // Text focus state
  isAnyTextFocused = false,
  onTextFocusChange,
  // Mode
  isEditMode = true,
  // Selection
  isSelected = false,
  onToggleSelect,
}: ReceiptItemProps) {
  /** ---------------- UI State ---------------- */
  const [uiState, setUIState] = useState<UIState>({
    isHovering: false,
    newlyAddedTags: new Set(),
  });

  /** ---------------- Drag State ---------------- */
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isInParticipantBounds: false,
    currentPosition: { x: 0, y: 0 },
  });

  /** ---------------- Drag Refs ---------------- */
  const localPan = useRef(new Animated.ValueXY()).current;
  const pan = externalDragPan || localPan;
  const panRef = useRef(pan);
  panRef.current = pan;
  const viewRef = useRef<View>(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });
  const isAnyTextFocusedRef = useRef(isAnyTextFocused);
  isAnyTextFocusedRef.current = isAnyTextFocused;

  /** ---------------- Computed Values ---------------- */
  const sortedUserTags = item.userTags
    ? [...item.userTags].sort((a, b) => a - b)
    : [];
  const inParticipantBounds =
    isInParticipantBoundsProp !== undefined
      ? isInParticipantBoundsProp
      : dragState.isInParticipantBounds;
  const isCurrentlyDragging = dragState.isDragging || isDraggingProp;

  /** ---------------- Collision Detection ---------------- */
  const checkParticipantCollision = useCallback(
    (x: number, y: number): number | null => {
      let closestParticipant: { id: number; distance: number } | null = null;

      for (const [idStr, layout] of Object.entries(participantLayouts)) {
        const id = Number(idStr);

        const adjustedLayout = {
          ...layout,
          x: layout.x - scrollOffset,
        };

        if (
          x >= adjustedLayout.x &&
          x <= adjustedLayout.x + adjustedLayout.width &&
          y >= adjustedLayout.y &&
          y <= adjustedLayout.y + adjustedLayout.height
        ) {
          const participantCenterX =
            adjustedLayout.x + adjustedLayout.width / 2;
          const participantCenterY =
            adjustedLayout.y + adjustedLayout.height / 2;

          const distance = Math.sqrt(
            Math.pow(x - participantCenterX, 2) +
              Math.pow(y - participantCenterY, 2),
          );

          if (!closestParticipant || distance < closestParticipant.distance) {
            closestParticipant = { id, distance };
          }
        }
      }

      return closestParticipant?.id ?? null;
    },
    [participantLayouts, scrollOffset],
  );

  /** ---------------- Worklet-safe handlers ---------------- */
  const handleDragStart = useCallback(
    (touchX: number, touchY: number) => {
      setDragState((prev) => ({ ...prev, isDragging: true }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDragStart?.(item.id, { x: touchX, y: touchY });
    },
    [item.id, onDragStart],
  );

  const handleDragChange = useCallback(
    (x: number, y: number, translationX: number, translationY: number) => {
      panRef.current.setValue({ x: translationX, y: translationY });

      currentPositionRef.current = { x, y };
      setDragState((prev) => ({ ...prev, currentPosition: { x, y } }));

      const participantId = checkParticipantCollision(x, y);
      const inBounds = participantId !== null;
      setDragState((prev) => ({ ...prev, isInParticipantBounds: inBounds }));
      onParticipantBoundsChange?.(inBounds);
    },
    [checkParticipantCollision, onParticipantBoundsChange],
  );

  const handleDragEnd = useCallback(() => {
    const participantId = checkParticipantCollision(
      currentPositionRef.current.x,
      currentPositionRef.current.y,
    );
    if (participantId !== null) {
      if (onDropOnParticipant) {
        onDropOnParticipant(participantId);
      } else {
        const currentItem = getCurrentItemData ? getCurrentItemData() : item;
        const updatedTags = currentItem.userTags
          ? [...currentItem.userTags]
          : [];
        if (!updatedTags.includes(participantId)) {
          updatedTags.push(participantId);
          onUpdate({ userTags: updatedTags });
        }
      }
    }
  }, [
    checkParticipantCollision,
    getCurrentItemData,
    item,
    onUpdate,
    onDropOnParticipant,
  ]);

  const handleDragFinalize = useCallback(() => {
    setDragState({
      isDragging: false,
      isInParticipantBounds: false,
      currentPosition: { x: 0, y: 0 },
    });
    onDragEnd?.();

    Animated.spring(panRef.current, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();

    currentPositionRef.current = { x: 0, y: 0 };
  }, [onDragEnd]);

  /** ---------------- Pan Gesture ---------------- */
  const panGesture = useMemo(() => {
    const base =
      !isEditMode && isSelected
        ? Gesture.Pan().minDistance(5)
        : Gesture.Pan().activateAfterLongPress(250);
    return base
      .onStart((event) => {
        'worklet';
        if (isAnyTextFocusedRef.current) return;
        handleDragStart(event.absoluteX, event.absoluteY);
      })
      .onChange((event) => {
        'worklet';
        if (isAnyTextFocusedRef.current) return;
        handleDragChange(
          event.absoluteX,
          event.absoluteY,
          event.translationX,
          event.translationY,
        );
      })
      .onEnd(() => {
        'worklet';
        handleDragEnd();
      })
      .onFinalize(() => {
        'worklet';
        handleDragFinalize();
      })
      .runOnJS(true);
  }, [
    isEditMode,
    isSelected,
    handleDragStart,
    handleDragChange,
    handleDragEnd,
    handleDragFinalize,
  ]);

  /** ---------------- Input Handlers ---------------- */
  const handlePriceChange = (value: string) => {
    const numericValue = value.replace(/[^\d.]/g, '');
    onUpdate?.({ price: numericValue });
  };

  /** ---------------- Delete with Warning ---------------- */
  const confirmDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name || 'this item'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete() },
      ],
    );
  };

  const confirmRemoveTag = (userId: number) => {
    Alert.alert(
      'Remove User',
      `Remove user ${userId} from "${item.name || 'this item'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemoveFromUser(userId),
        },
      ],
    );
  };

  /** ---------------- Render ---------------- */

  // Non-edit mode (claim mode) rendering
  if (!isEditMode) {
    return (
      <GestureHandlerRootView>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            ref={viewRef}
            style={[
              isDraggingOverlay && {
                minWidth: '100%',
                position: 'absolute' as const,
                zIndex: 9999,
                elevation: 9999,
                padding: 16,
              },
              isDraggingOverlay &&
                initialPosition && {
                  top: initialPosition.y,
                  left: initialPosition.x,
                },
            ]}
          >
            {/* Wrapper: constant paddingBottom reserves space for the straddling tags */}
            <View style={{ paddingBottom: 11 }}>
              <Pressable
                onPress={onToggleSelect}
                className='w-full bg-card rounded-2xl p-4'
              >
                {/* Inset selection border */}
                {isSelected && (
                  <View
                    className='absolute inset-0 rounded-2xl border-2 border-primary'
                    pointerEvents='none'
                  />
                )}
                <View className='flex-row items-center'>
                  {/* Delete button */}
                  <Pressable
                    onPress={confirmDelete}
                    className='w-10 h-10 items-center justify-center mr-3'
                    accessibilityLabel='Delete item'
                  >
                    <Text className='text-destructive text-2xl font-bold'>
                      ✕
                    </Text>
                  </Pressable>

                  {/* Item name */}
                  <Text
                    className='text-foreground font-extrabold text-xl flex-1 mr-2'
                    numberOfLines={1}
                  >
                    {item.name || 'Unnamed Item'}
                  </Text>

                  {/* Price */}
                  <Text className='text-foreground font-extrabold text-xl'>
                    ${item.price || '0.00'}
                  </Text>
                </View>
              </Pressable>

              {/* User tags: straddle the card bottom edge, with remove buttons */}
              {sortedUserTags.length > 0 && (
                <View
                  style={{ position: 'absolute', bottom: 0, left: 52 }}
                  className='flex-row flex-wrap gap-1'
                >
                  {sortedUserTags.map((userId) => (
                    <UserTag
                      key={userId}
                      id={userId}
                      onRemove={() => confirmRemoveTag(userId)}
                      isNewlyAdded={false}
                      isEditMode={true}
                    />
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }

  // Edit mode rendering
  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          ref={viewRef}
          style={[
            isDraggingOverlay && {
              minWidth: '100%',
              position: 'absolute' as const,
              zIndex: 9999,
              elevation: 9999,
              padding: 16,
            },
            isDraggingOverlay &&
              initialPosition && {
                top: initialPosition.y,
                left: initialPosition.x,
              },
            {
              transform: isCurrentlyDragging ? pan.getTranslateTransform() : [],
              zIndex: isCurrentlyDragging ? 9999 : 0,
              elevation: isCurrentlyDragging ? 9999 : 0,
            },
          ]}
        >
          {/* Wrapper: constant paddingBottom reserves space for the straddling tags */}
          <View style={{ paddingBottom: 11 }}>
            <View className='w-full bg-card rounded-2xl p-4'>
              <View className='flex-row items-center'>
                {/* Delete button */}
                <Pressable
                  onPress={confirmDelete}
                  className='w-10 h-10 items-center justify-center mr-3'
                  accessibilityLabel='Delete item'
                >
                  <Text className='text-destructive text-2xl font-bold'>✕</Text>
                </Pressable>

                {/* Editable item name */}
                <TextInput
                  value={item.name}
                  onChangeText={(text) => onUpdate({ name: text })}
                  placeholder='Item name'
                  className='text-muted-foreground font-extrabold text-xl flex-1 mr-2 placeholder:text-muted-foreground'
                  style={inputStyles.name}
                  numberOfLines={1}
                  onFocus={() => onTextFocusChange?.(true)}
                  onBlur={() => onTextFocusChange?.(false)}
                />

                {/* Editable price */}
                <View className='flex-row items-center'>
                  <Text className='text-foreground font-extrabold text-xl'>
                    $
                  </Text>
                  <TextInput
                    value={item.price}
                    onChangeText={handlePriceChange}
                    placeholder='0.00'
                    className='text-foreground font-extrabold text-xl placeholder:text-muted-foreground'
                    style={inputStyles.price}
                    keyboardType='numeric'
                    numberOfLines={1}
                    onFocus={() => onTextFocusChange?.(true)}
                    onBlur={() => onTextFocusChange?.(false)}
                  />
                </View>
              </View>
            </View>

            {/* User tags: straddle the card bottom edge (half in, half out) */}
            {sortedUserTags.length > 0 && (
              <View
                style={{ position: 'absolute', bottom: 0, left: 52 }}
                className='flex-row flex-wrap gap-1'
              >
                {sortedUserTags.map((userId) => (
                  <UserTag
                    key={userId}
                    id={userId}
                    onRemove={() => confirmRemoveTag(userId)}
                    isNewlyAdded={false}
                    isEditMode={true}
                  />
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
