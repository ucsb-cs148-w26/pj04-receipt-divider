import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  LayoutRectangle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import { ReceiptItemData } from '@shared/types';
import { UserTag } from '@shared/components/UserTag';

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
}

/** Internal drag state */
interface DragState {
  isDragging: boolean;
  isInParticipantBounds: boolean;
  currentPosition: { x: number; y: number };
}

/** Internal UI state */
interface UIState {
  showDiscount: boolean;
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
  // Fresh data getter for overlay
  getCurrentItemData,
  // Text focus state
  isAnyTextFocused = false,
  onTextFocusChange,
}: ReceiptItemProps) {
  /** ---------------- UI State ---------------- */
  const [uiState, setUIState] = useState<UIState>({
    showDiscount: !!item.discount && parseFloat(item.discount) > 0,
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
  // Create local pan first (always)
  const localPan = useRef(new Animated.ValueXY()).current;
  // Use external pan if provided (for overlay), otherwise use local pan
  const pan = externalDragPan || localPan;
  // Keep a ref to current pan so panResponder can access it
  const panRef = useRef(pan);
  panRef.current = pan;
  const viewRef = useRef<View>(null);
  // Ref to track current position (avoids stale closure in gesture)
  const currentPositionRef = useRef({ x: 0, y: 0 });
  // Ref to track text focus state for immediate access in gesture
  const isAnyTextFocusedRef = useRef(isAnyTextFocused);
  isAnyTextFocusedRef.current = isAnyTextFocused;

  /** ---------------- Computed Values ---------------- */
  // Sort user tags in increasing order
  const sortedUserTags = item.userTags
    ? [...item.userTags].sort((a, b) => a - b)
    : [];
  // Use prop for overlay, local state for original
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

        // Check if the gesture position overlaps with this participant
        if (
          x >= adjustedLayout.x &&
          x <= adjustedLayout.x + adjustedLayout.width &&
          y >= adjustedLayout.y &&
          y <= adjustedLayout.y + adjustedLayout.height
        ) {
          // Calculate distance from gesture position to participant center
          const participantCenterX =
            adjustedLayout.x + adjustedLayout.width / 2;
          const participantCenterY =
            adjustedLayout.y + adjustedLayout.height / 2;

          const distance = Math.sqrt(
            Math.pow(x - participantCenterX, 2) +
              Math.pow(y - participantCenterY, 2),
          );

          // Keep track of the closest participant
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
  const handleDragStart = useCallback(() => {
    setDragState((prev) => ({ ...prev, isDragging: true }));
    if (viewRef.current) {
      viewRef.current.measureInWindow((x, y, width, height) => {
        onDragStart?.(item.id, { x, y });
      });
    }
  }, [item.id, onDragStart]);

  const handleDragChange = useCallback(
    (x: number, y: number, translationX: number, translationY: number) => {
      // Update animated value safely
      panRef.current.setValue({ x: translationX, y: translationY });

      // Update ref for use in end handler (avoids stale closure)
      currentPositionRef.current = { x, y };
      setDragState((prev) => ({ ...prev, currentPosition: { x, y } }));

      // Check collision with participants
      const participantId = checkParticipantCollision(x, y);
      const inBounds = participantId !== null;
      setDragState((prev) => ({ ...prev, isInParticipantBounds: inBounds }));
      onParticipantBoundsChange?.(inBounds);
      //console.log('Dragging over participant:', participantId);
    },
    [checkParticipantCollision, onParticipantBoundsChange],
  );

  const handleDragEnd = useCallback(() => {
    // Use ref to get current position (avoids stale closure)
    const participantId = checkParticipantCollision(
      currentPositionRef.current.x,
      currentPositionRef.current.y,
    );
    console.log('Dropped on participant:', participantId);
    if (participantId !== null) {
      // Get the most current item data (especially important for overlay)
      const currentItem = getCurrentItemData ? getCurrentItemData() : item;
      // Add participant to userTags if not already there
      const updatedTags = currentItem.userTags ? [...currentItem.userTags] : [];
      if (!updatedTags.includes(participantId)) {
        updatedTags.push(participantId);
        onUpdate({ userTags: updatedTags });
      } else {
        console.log(
          'Participant',
          participantId,
          'already in tags:',
          updatedTags,
        );
      }
    }
  }, [checkParticipantCollision, getCurrentItemData, item, onUpdate]);

  const handleDragFinalize = useCallback(() => {
    // Reset drag state
    setDragState({
      isDragging: false,
      isInParticipantBounds: false,
      currentPosition: { x: 0, y: 0 },
    });
    onDragEnd?.();

    // Animate back to original position
    Animated.spring(panRef.current, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();

    // Reset position ref
    currentPositionRef.current = { x: 0, y: 0 };
  }, [onDragEnd]);

  /** ---------------- Pan Gesture ---------------- */
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(250)
        .onStart(() => {
          'worklet';
          // Check ref value at gesture start to ensure most current state
          if (isAnyTextFocusedRef.current) {
            return; // Cancel gesture if text is focused
          }
          handleDragStart();
        })
        .onChange((event) => {
          'worklet';
          // Check ref value at gesture start to ensure most current state
          if (isAnyTextFocusedRef.current) {
            return; // Cancel gesture if text is focused
          }
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
        .runOnJS(true),
    [handleDragStart, handleDragChange, handleDragEnd, handleDragFinalize],
  );

  /** ---------------- Input Handlers ---------------- */
  const handlePriceChange = (value: string) => {
    const numericValue = value.replace(/[^\d.]/g, '');
    onUpdate?.({ price: numericValue });
  };

  const handleDiscountChange = (value: string) => {
    const numericValue = value.replace(/[^\d.]/g, '');
    onUpdate?.({ discount: numericValue });
  };

  const handleDiscountBlur = () => {
    const discountValue = parseFloat(item.discount || '0');
    if (discountValue <= 0 || !item.discount) {
      setUIState((prev) => ({ ...prev, showDiscount: false }));
      onUpdate?.({ discount: undefined });
    }
  };

  /** ---------------- UI State Handlers ---------------- */
  const setShowDiscount = (show: boolean) => {
    setUIState((prev) => ({ ...prev, showDiscount: show }));
  };

  const setIsHovering = (hovering: boolean) => {
    setUIState((prev) => ({ ...prev, isHovering: hovering }));
  };

  /** ---------------- Render ---------------- */
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
              width: isCurrentlyDragging && inParticipantBounds ? 150 : 'auto',
              height: isCurrentlyDragging && inParticipantBounds ? 150 : 'auto',
              zIndex: isCurrentlyDragging ? 9999 : 0,
              elevation: isCurrentlyDragging ? 9999 : 0,
            },
          ]}
        >
          <Pressable
            className='w-full bg-surface-elevated border border-border rounded-lg p-4 pl-6 pr-6 pb-6 mb-2'
            onHoverIn={() => setIsHovering(true)}
            onHoverOut={() => setIsHovering(false)}
            onPressIn={() => setIsHovering(true)}
            onPressOut={() => setIsHovering(false)}
          >
            <View className='flex-row justify-between gap-2'>
              <View className='flex-row items-start gap-3 flex-1 min-w-0'>
                {
                  <Pressable
                    onPress={() => {
                      if (onDelete) onDelete();
                    }}
                    className='min-w-[24px] items-center mt-1'
                    accessibilityLabel='Delete item'
                  >
                    <Text className='text-destructive text-xl font-bold'>
                      ✕
                    </Text>
                  </Pressable>
                }
                <View className='flex-1 min-w-0'>
                  {
                    <TextInput
                      value={item.name}
                      onChangeText={(text) => onUpdate({ name: text })}
                      placeholder='Item name'
                      className='rounded bg-background p-2 text-foreground'
                      onFocus={() => {
                        onTextFocusChange?.(true);
                        console.log('Name input focused');
                      }}
                      onBlur={() => {
                        onTextFocusChange?.(false);
                        console.log('Name input blurred');
                      }}
                    />
                  }
                </View>
              </View>

              <View className='flex-col items-end gap-2'>
                {/* Price */}
                <View className='flex-row items-center gap-1'>
                  {
                    <View className='flex-row items-center'>
                      <Text className='text-foreground font-bold'>$</Text>
                      <TextInput
                        value={item.price}
                        onChangeText={handlePriceChange}
                        placeholder='0.00'
                        className='w-20 bg-background rounded p-2 text-foreground font-bold text-right'
                        keyboardType='numeric'
                        onFocus={() => onTextFocusChange?.(true)}
                        onBlur={() => onTextFocusChange?.(false)}
                      />
                    </View>
                  }
                </View>

                {/* Discount section - right justified */}
                {uiState.showDiscount ? (
                  <View className='flex-row items-center justify-end gap-1'>
                    <Text className='text-xs text-foreground'>Discount:</Text>
                    <Text className='text-foreground text-sm'>$</Text>
                    <TextInput
                      value={item.discount || ''}
                      onChangeText={handleDiscountChange}
                      onFocus={() => onTextFocusChange?.(true)}
                      onBlur={() => {
                        handleDiscountBlur();
                        onTextFocusChange?.(false);
                      }}
                      placeholder='0.00'
                      className='w-16 bg-background rounded p-2 text-foreground text-sm text-right'
                      keyboardType='numeric'
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowDiscount(true)}
                    className='flex-row gap-1 p-2 rounded self-end ml-auto items-end justify-end min-w-[130px]'
                    accessibilityLabel='Add discount'
                  >
                    <Text className='text-xs text-primary'>+ Discount</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* User tags - positioned at bottom extending below box */}
            {sortedUserTags.length > 0 && (
              <View className='absolute -bottom-3 left-4 right-4 flex-row flex-wrap gap-2 z-10'>
                {sortedUserTags.map((userId) => {
                  const isNewlyAdded =
                    uiState.newlyAddedTags.has(userId) &&
                    (item.userTags?.includes(userId) ?? false);
                  return (
                    <UserTag
                      key={userId}
                      id={userId}
                      onRemove={() => onRemoveFromUser?.(userId)}
                      isNewlyAdded={isNewlyAdded}
                    />
                  );
                })}
              </View>
            )}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
