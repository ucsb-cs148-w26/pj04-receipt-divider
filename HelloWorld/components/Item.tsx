import { useTheme } from '@react-navigation/native';
import { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  LayoutRectangle,
} from 'react-native';
import UserTag from './user-tags';
import { ITEMCONTAINERPADDING } from '@/app/Receipt_Room_Page';
//import { USER_COLORS } from '@/app/components/AppScreen';

const USER_COLORS = [
  '#60a5fa',     // blue-400
  '#f87171',     // red-400
  '#4ade80',     // green-400
  '#fbbf24',     // yellow-400
  '#a78bfa',     // purple-400
  '#f472b6',     // pink-400
  '#818cf8',     // indigo-400
  '#fb923c',     // orange-400
  '#2dd4bf',     // teal-400
  '#22d3ee',     // cyan-400
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
  onDragStart?: (itemId?: number, initialPosition?: { x: number; y: number }) => void;
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
  // Ref to track current position (avoids stale closure in panResponder)
  const currentPositionRef = useRef({ x: 0, y: 0 });
  // Long press timer for delayed drag start
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const LONG_PRESS_DELAY = 250; // 0.25 seconds

  /** ---------------- Computed Values ---------------- */
  // Sort user tags in increasing order
  const sortedUserTags = item.userTags ? [...item.userTags].sort((a, b) => a - b) : [];
  // Use prop for overlay, local state for original
  const inParticipantBounds = isInParticipantBoundsProp !== undefined 
    ? isInParticipantBoundsProp 
    : dragState.isInParticipantBounds;
  const isCurrentlyDragging = dragState.isDragging || isDraggingProp;

  /** ---------------- Collision Detection ---------------- */
  const checkParticipantCollision = (x: number, y: number): number | null => {
    const draggableSize = 150;

    for (const [idStr, layout] of Object.entries(participantLayouts)) {
      const id = Number(idStr);
      
      const adjustedLayout = {
        ...layout,
        x: layout.x - scrollOffset,
      };

      if (
        x + draggableSize >= adjustedLayout.x &&
        x <= adjustedLayout.x + adjustedLayout.width &&
        y + draggableSize >= adjustedLayout.y &&
        y <= adjustedLayout.y + adjustedLayout.height
      ) {
        return id;
      }
    }
    
    return null;
  };

  /** ---------------- Pan Responder ---------------- */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, gestureState) => {
        // Only respond to move if long press has triggered
        return longPressTriggered.current;
      },
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => longPressTriggered.current,
      onPanResponderGrant: (e, gestureState) => {
        // Start long press timer
        longPressTriggered.current = false;
        longPressTimer.current = setTimeout(() => {
          longPressTriggered.current = true;
          setDragState(prev => ({ ...prev, isDragging: true }));
          // Measure the view's position and pass it to parent
          if (viewRef.current) {
            viewRef.current.measureInWindow((x, y, width, height) => {
              onDragStart?.(item.id, { x, y });
            });
          } else {
            onDragStart?.(item.id, { x: gestureState.x0, y: gestureState.y0 });
          }
        }, LONG_PRESS_DELAY);
      },
      onPanResponderMove: (e, gestureState) => {
        // Only track movement if long press has triggered
        if (!longPressTriggered.current) return;
        
        // Use panRef.current to get the current pan value
        panRef.current.setValue({ x: gestureState.dx, y: gestureState.dy });
        
        const x = gestureState.x0 + gestureState.dx;
        const y = gestureState.y0 + gestureState.dy;
        
        // Update ref for use in release handler (avoids stale closure)
        currentPositionRef.current = { x, y };
        setDragState(prev => ({ ...prev, currentPosition: { x, y } }));

        const participantId = checkParticipantCollision(x, y);
        const inBounds = participantId !== null;
        setDragState(prev => ({ ...prev, isInParticipantBounds: inBounds }));
        onParticipantBoundsChange?.(inBounds);
      },
      onPanResponderRelease: () => {
        // Clear long press timer
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        
        // Only process drop if drag was actually started
        if (longPressTriggered.current) {
          // Use ref to get current position (avoids stale closure)
          const participantId = checkParticipantCollision(
            currentPositionRef.current.x, 
            currentPositionRef.current.y
          );
          console.log('Dropped on participant:', participantId);
          if (participantId !== null) {
            // Get the most current item data (especially important for overlay)
            const currentItem = getCurrentItemData ? getCurrentItemData() : item;
            console.log('Current item from getCurrentItemData:', currentItem);
            console.log('Current item.userTags before update:', currentItem.userTags);
            // Add participant to userTags if not already there
            const updatedTags = currentItem.userTags ? [...currentItem.userTags] : [];
            console.log('updatedTags after spreading existing:', updatedTags);
            if (!updatedTags.includes(participantId)) {
              updatedTags.push(participantId);
              console.log('Updated tags after push:', updatedTags);
              onUpdate({ userTags: updatedTags });
            } else {
              console.log('Participant', participantId, 'already in tags:', updatedTags);
            }
          }

          setDragState({
            isDragging: false,
            isInParticipantBounds: false,
            currentPosition: { x: 0, y: 0 },
          });
          onDragEnd?.();
          
          Animated.spring(
            panRef.current,
            { toValue: { x: 0, y: 0 }, useNativeDriver: false },
          ).start();
        }
        
        longPressTriggered.current = false;
        currentPositionRef.current = { x: 0, y: 0 };
      },
      onPanResponderTerminate: () => {
        // Clear timer if gesture is terminated
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        longPressTriggered.current = false;
      },
    })
  ).current;

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
      setUIState(prev => ({ ...prev, showDiscount: false }));
      onUpdate?.({ discount: undefined });
    }
  };

  /** ---------------- UI State Handlers ---------------- */
  const setShowDiscount = (show: boolean) => {
    setUIState(prev => ({ ...prev, showDiscount: show }));
  };

  const setIsHovering = (hovering: boolean) => {
    setUIState(prev => ({ ...prev, isHovering: hovering }));
  };

  /** ---------------- Render ---------------- */
  return (
    <Animated.View
      ref={viewRef}
      {...panResponder.panHandlers}
      style={[
        isDraggingOverlay && styles.draggingOverlay,
        isDraggingOverlay && initialPosition && {
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
        style={[
          isCurrentlyDragging && inParticipantBounds ? styles.containerShrunk : styles.container,
          uiState.isHovering && !isCurrentlyDragging && styles.containerHover,
        ]}
        onHoverIn={() => setIsHovering(true)}
        onHoverOut={() => setIsHovering(false)}
        onPressIn={() => setIsHovering(true)}
        onPressOut={() => setIsHovering(false)}
        {...panResponder.panHandlers}
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
              {<Text style={styles.deleteIcon}>✕</Text>}
            </Pressable>
          }
          <View style={styles.nameContainer}>
            {
              <TextInput
                value={item.name}
                onChangeText={(text) => onUpdate({ name: text })}
                placeholder='Item name'
                style={styles.nameInput}
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
                onBlur={handleDiscountBlur}
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
            const color = USER_COLORS[(userIndex - 1) % USER_COLORS.length];
            const isNewlyAdded = uiState.newlyAddedTags.has(userIndex) && (item.userTags?.includes(userIndex) ?? false);
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
    container: {
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
    containerShrunk: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    containerHover: {
      transform: [{ scale: 1.03 }],
    },
    shrunkItemContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 8,
    },
    shrunkItemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
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