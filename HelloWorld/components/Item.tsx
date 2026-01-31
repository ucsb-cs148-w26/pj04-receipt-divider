import { useTheme } from '@react-navigation/native';
import { useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  LayoutRectangle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import UserTag from './user-tags';
import { ITEMCONTAINERPADDING } from '@/app/Receipt_Room_Page';
//import { USER_COLORS } from '@/app/components/AppScreen';

const USER_COLORS = [
  '#60a5fa', // blue-400
  '#f87171', // red-400
  '#4ade80', // green-400
  '#fbbf24', // yellow-400
  '#a78bfa', // purple-400
  '#f472b6', // pink-400
  '#818cf8', // indigo-400
  '#fb923c', // orange-400
  '#2dd4bf', // teal-400
  '#22d3ee', // cyan-400
];

interface NativeThemeColorType {
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
}

export interface ReceiptItemType {
  id: number;
  name: string;
  price: string;
  userTags?: number[]; // Array of user indices that have this item in their basket
  discount?: string; // Optional discount amount
}

/** Drag-related props grouped together */
interface DragProps {
  participantLayouts?: Record<number, LayoutRectangle>;
  scrollOffset?: number;
  onDragStart?: (
    itemId?: number,
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
  item: ReceiptItemType;

  /** Item update callbacks */
  onUpdate: (updates: {
    name?: string;
    price?: string;
    discount?: string;
    userTags?: number[];
  }) => void;
  onDelete: () => void;
  onRemoveFromUser: (userIndex: number) => void;

  /** Function to get current item data (for overlay to get fresh data) */
  getCurrentItemData?: () => ReceiptItemType;

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
  /** ---------------- Theme ---------------- */
  const { colors, dark } = useTheme();
  const styles = useMemo(() => createStyles(colors, dark), [colors, dark]);

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
            isDraggingOverlay && styles.draggingOverlay,
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
            style={[styles.topContainer]}
            onHoverIn={() => setIsHovering(true)}
            onHoverOut={() => setIsHovering(false)}
            onPressIn={() => setIsHovering(true)}
            onPressOut={() => setIsHovering(false)}
          >
            <View style={styles.header}>
              <View style={styles.leftSection}>
                {
                  <Pressable
                    onPress={() => {
                      if (onDelete) onDelete();
                    }}
                    style={styles.deleteButton}
                    accessibilityLabel='Delete item'
                  >
                    <Text style={styles.deleteIcon}>✕</Text>
                  </Pressable>
                }
                <View style={styles.nameContainer}>
                  {
                    <TextInput
                      value={item.name}
                      onChangeText={(text) => onUpdate({ name: text })}
                      placeholder='Item name'
                      style={styles.nameInput}
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

              <View style={styles.rightSection}>
                {/* Price */}
                <View style={styles.priceContainer}>
                  {
                    <View style={styles.priceInputContainer}>
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        value={item.price}
                        onChangeText={handlePriceChange}
                        placeholder='0.00'
                        style={styles.priceInput}
                        keyboardType='numeric'
                        onFocus={() => onTextFocusChange?.(true)}
                        onBlur={() => onTextFocusChange?.(false)}
                      />
                    </View>
                  }
                </View>

                {/* Discount section - right justified */}
                {uiState.showDiscount ? (
                  <View style={styles.discountContainer}>
                    <Text style={styles.discountLabel}>Discount:</Text>
                    <Text style={styles.discountDollar}>$</Text>
                    <TextInput
                      value={item.discount || ''}
                      onChangeText={handleDiscountChange}
                      onFocus={() => onTextFocusChange?.(true)}
                      onBlur={() => {
                        handleDiscountBlur();
                        onTextFocusChange?.(false);
                      }}
                      placeholder='0.00'
                      style={styles.discountInput}
                      keyboardType='numeric'
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowDiscount(true)}
                    style={styles.addDiscountButton}
                    accessibilityLabel='Add discount'
                  >
                    <Text style={styles.addDiscountText}>+ Discount</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* User tags - positioned at bottom extending below box */}
            {sortedUserTags.length > 0 && (
              <View style={styles.userTagsContainer}>
                {sortedUserTags.map((userIndex) => {
                  const color =
                    USER_COLORS[(userIndex - 1) % USER_COLORS.length];
                  const isNewlyAdded =
                    uiState.newlyAddedTags.has(userIndex) &&
                    (item.userTags?.includes(userIndex) ?? false);
                  return (
                    <UserTag
                      key={userIndex}
                      userIndex={userIndex}
                      color={color}
                      onRemove={() => onRemoveFromUser?.(userIndex)}
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

const createStyles = (colors: NativeThemeColorType, dark: boolean) =>
  StyleSheet.create({
    draggingOverlay: {
      minWidth: '100%',
      position: 'absolute',
      zIndex: 9999,
      elevation: 9999,
      padding: ITEMCONTAINERPADDING,
    },
    topContainer: {
      minWidth: '100%',
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 24,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    deleteButton: {
      minWidth: 24,
      alignItems: 'center',
      marginTop: 4,
    },
    deleteIcon: {
      color: dark ? '#873030' : '#d42e2e',
      fontSize: 20,
      fontWeight: 'bold',
    },
    gripIcon: {
      color: colors.text,
      fontSize: 20,
    },
    nameContainer: {
      flex: 1,
      minWidth: 0,
    },
    nameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 8,
      color: colors.text,
    },
    nameText: {
      color: colors.text,
    },
    rightSection: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    priceInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dollarSign: {
      color: colors.text,
      fontWeight: 'bold',
    },
    priceInput: {
      width: 80,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 8,
      color: colors.text,
      fontWeight: 'bold',
      textAlign: 'right',
    },
    priceText: {
      color: colors.text,
      fontWeight: 'bold',
    },
    discountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    discountLabel: {
      fontSize: 12,
      color: colors.text,
    },
    discountDollar: {
      color: colors.text,
      fontSize: 14,
    },
    discountInput: {
      width: 64,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 8,
      color: colors.text,
      fontSize: 14,
      textAlign: 'right',
    },
    addDiscountButton: {
      minWidth: 130,
      flexDirection: 'row',
      gap: 4,
      padding: 8,
      borderRadius: 4,
      alignSelf: 'flex-end',
      marginLeft: 'auto',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
    },
    addDiscountText: {
      fontSize: 12,
      color: '#2563eb',
    },
    userTagsContainer: {
      position: 'absolute',
      bottom: -12,
      left: 16,
      right: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      zIndex: 10,
    },
    userTag: {
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    userTagNew: {
      transform: [{ scale: 1.1 }],
    },
    userTagRemove: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    userTagText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
  });
