import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  LayoutRectangle,
  StyleSheet,
} from 'react-native';

// React Native provides setTimeout/clearTimeout globally; these casts satisfy TypeScript
// when the project's lib config does not include DOM types.
/* eslint-disable @typescript-eslint/no-explicit-any */
const _setTimeout = (globalThis as any).setTimeout as (
  ..._args: any[]
) => number;
const _clearTimeout = (globalThis as any).clearTimeout as (
  ..._args: any[]
) => void;
/* eslint-enable @typescript-eslint/no-explicit-any */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ReceiptItemData } from '@shared/types';
import { UserTag } from '@shared/components/UserTag';
import { ScrollableTextInput } from '@shared/components/ScrollableTextInput';
import { PriceInput } from '@shared/components/PriceInput';
import type { ScrollToInputContext } from '@shared/hooks/useScrollToInput';

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
  /** Called on every drag move with the current translation from origin */
  onDragMove?: (translation: { x: number; y: number }) => void;
  /** Reanimated shared value updated directly on the UI thread during drag — avoids JS-bridge lag */
  bannerTranslation?: SharedValue<{ x: number; y: number }>;
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
  onDelete?: () => void;
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

  /** Animated value driven by the parent (0 = claim mode, 1 = edit mode). When provided,
   *  the parent starts the animation imperatively before the state update, eliminating
   *  the 1-frame flash that occurs when using a local useEffect. */
  editModeAnim?: Animated.Value;

  /** Scroll context from useScrollToInput — enables scroll-to-focus on edit-mode inputs. */
  scrollContext?: ScrollToInputContext;

  /** Map from participant id (1-based) to their hex accent color. When provided,
   *  overrides the default avatar-X palette color on UserTag badges. */
  participantColors?: Record<number, string>;

  /** Set of participant IDs whose tags may be removed. When undefined all tags
   *  are removable (host / solo room). When provided, only matching IDs show
   *  the X button in edit mode. */
  removableTagIds?: Set<number>;
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
  onDragMove,
  bannerTranslation,
  // Fresh data getter for overlay
  getCurrentItemData,
  // Text focus state
  isAnyTextFocused = false,
  onTextFocusChange,
  // Mode
  isEditMode = true,
  editModeAnim: editModeAnimProp,
  // Selection
  isSelected = false,
  onToggleSelect,
  // Scroll-to-focus
  scrollContext,
  // Participant accent colors
  participantColors,
  // Removable tag IDs
  removableTagIds,
}: ReceiptItemProps) {
  /** ---------------- UI State ---------------- */
  const [uiState, setUIState] = useState<UIState>({
    isHovering: false,
    newlyAddedTags: new Set(),
  });

  /** ---------------- Tag enter/exit animation tracking ---------------- */
  // Use derived-state-from-props pattern so entering/exiting are set on the
  // *same* render that item.userTags changes, preventing the 1-frame flash
  // where new tags appear at full scale or removed tags vanish instantly.
  const [prevUserTags, setPrevUserTags] = useState(item.userTags);
  const [enteringTagIds, setEnteringTagIds] = useState<Set<number>>(new Set());
  const [exitingTagIds, setExitingTagIds] = useState<Set<number>>(new Set());

  if (prevUserTags !== item.userTags) {
    const prevSet = new Set(prevUserTags ?? []);
    const currSet = new Set(item.userTags ?? []);
    const added = [...currSet].filter((id) => !prevSet.has(id));
    const removed = [...prevSet].filter((id) => !currSet.has(id));
    // Calling setters during render triggers an immediate re-render before paint.
    setPrevUserTags(item.userTags);
    if (added.length > 0)
      setEnteringTagIds((prev) => new Set([...prev, ...added]));
    if (removed.length > 0)
      setExitingTagIds((prev) => new Set([...prev, ...removed]));
  }

  // Clear entering tags after their pop-in animation completes.
  useEffect(() => {
    if (enteringTagIds.size === 0) return;
    const ids = [...enteringTagIds];
    const t = _setTimeout(() => {
      setEnteringTagIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 500);
    return () => _clearTimeout(t);
  }, [enteringTagIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear exiting tags after their pop-out animation completes.
  useEffect(() => {
    if (exitingTagIds.size === 0) return;
    const ids = [...exitingTagIds];
    const t = _setTimeout(() => {
      setExitingTagIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 350);
    return () => _clearTimeout(t);
  }, [exitingTagIds]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const itemScale = useRef(new Animated.Value(1)).current;
  // Use parent-provided animated value when available so the animation starts
  // before the React render (eliminating the 1-frame blank flash on mode switch).
  const localEditAnim = useRef(new Animated.Value(isEditMode ? 1 : 0)).current;
  const editAnim = editModeAnimProp ?? localEditAnim;
  const claimAnim = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const isAnyTextFocusedS = useSharedValue(isAnyTextFocused);
  useEffect(() => {
    isAnyTextFocusedS.value = isAnyTextFocused;
  }, [isAnyTextFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  /** ---------------- Selection animation ---------------- */
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(selectAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 50,
      useNativeDriver: true,
    }).start();
  }, [isSelected]); // eslint-disable-line react-hooks/exhaustive-deps
  const deSelectAnim = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  /** ---------------- Pop all selected items when group drag starts/ends ---------------- */
  useEffect(() => {
    if (isDraggingProp) {
      Animated.spring(itemScale, {
        toValue: 1.07,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      }).start();
    } else {
      Animated.spring(itemScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 10,
      }).start();
    }
  }, [isDraggingProp]); // eslint-disable-line react-hooks/exhaustive-deps

  /** ---------------- Computed Values ---------------- */
  const sortedUserTags = useMemo(
    () => (item.userTags ? [...item.userTags].sort((a, b) => a - b) : []),
    [item.userTags],
  );

  const allDisplayTagIds = useMemo(() => {
    const combined = new Set([...sortedUserTags, ...exitingTagIds]);
    return [...combined].sort((a, b) => a - b);
  }, [sortedUserTags, exitingTagIds]);

  const inParticipantBounds =
    isInParticipantBoundsProp !== undefined
      ? isInParticipantBoundsProp
      : dragState.isInParticipantBounds;

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
      Animated.spring(itemScale, {
        toValue: 1.07,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      }).start();
      onDragStart?.(item.id, { x: touchX, y: touchY });
    },
    [item.id, onDragStart, itemScale],
  );

  const handleDragChange = useCallback(
    (x: number, y: number, translationX: number, translationY: number) => {
      panRef.current.setValue({ x: translationX, y: translationY });
      onDragMove?.({ x: translationX, y: translationY });

      currentPositionRef.current = { x, y };
      setDragState((prev) => ({ ...prev, currentPosition: { x, y } }));

      const participantId = checkParticipantCollision(x, y);
      const inBounds = participantId !== null;
      setDragState((prev) => ({ ...prev, isInParticipantBounds: inBounds }));
      onParticipantBoundsChange?.(inBounds);
    },
    [checkParticipantCollision, onParticipantBoundsChange, onDragMove],
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

    Animated.spring(itemScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();

    Animated.spring(panRef.current, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();

    currentPositionRef.current = { x: 0, y: 0 };
  }, [onDragEnd, itemScale]);

  /** ---------------- Pan Gesture ---------------- */
  const panGesture = useMemo(() => {
    // In edit mode, disable drag entirely — enabled(false) lets scroll events
    // pass through to the parent ScrollView instead of being consumed.
    if (isEditMode) {
      return Gesture.Pan().enabled(false);
    }
    const base = isSelected
      ? Gesture.Pan().activateAfterLongPress(100)
      : Gesture.Pan().activateAfterLongPress(250);
    return base
      .onStart((event) => {
        'worklet';
        if (isAnyTextFocusedS.value) return;
        runOnJS(handleDragStart)(event.absoluteX, event.absoluteY);
      })
      .onChange((event) => {
        'worklet';
        if (isAnyTextFocusedS.value) return;
        if (bannerTranslation) {
          bannerTranslation.value = {
            x: event.translationX,
            y: event.translationY,
          };
        }
        runOnJS(handleDragChange)(
          event.absoluteX,
          event.absoluteY,
          event.translationX,
          event.translationY,
        );
      })
      .onEnd(() => {
        'worklet';
        runOnJS(handleDragEnd)();
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(handleDragFinalize)();
      });
  }, [
    isEditMode,
    isSelected,
    handleDragStart,
    handleDragChange,
    handleDragEnd,
    handleDragFinalize,
    bannerTranslation,
    isAnyTextFocusedS,
  ]);

  /** ---------------- Render ---------------- */

  // Both layers crossfade simultaneously: editAnim drives the edit card opacity
  // while claimAnim (= 1 - editAnim) drives the claim card opacity.
  // Because opacity_edit + opacity_claim = 1 at all times, the background
  // always appears fully opaque and the content smoothly morphs without any
  // sub-pixel layout shift between the two card variants.
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
            { transform: [{ scale: itemScale }] },
          ]}
        >
          {/* Wrapper: constant paddingBottom reserves space for the straddling tags */}
          <View style={{ paddingBottom: 11 }}>
            {/* ── Base layer: Edit mode card (fades in with editAnim) ── */}
            <Animated.View
              pointerEvents={isEditMode ? 'auto' : 'none'}
              style={{ opacity: editAnim }}
            >
              <View className='w-full bg-card rounded-2xl p-4'>
                <View className='flex-row items-center'>
                  {/* Delete button — hidden when the current user doesn't own the receipt */}
                  {onDelete ? (
                    <Pressable
                      onPress={onDelete}
                      className='w-10 h-10 items-center justify-center mr-3'
                      accessibilityLabel='Delete item'
                    >
                      <Text className='text-destructive text-2xl font-bold'>
                        ✕
                      </Text>
                    </Pressable>
                  ) : (
                    <View className='w-10 h-10 mr-3' />
                  )}

                  {/* Editable item name */}
                  <ScrollableTextInput
                    scrollContext={scrollContext}
                    name='item-name'
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
                    <PriceInput
                      scrollContext={scrollContext}
                      name='item-price'
                      value={item.price}
                      onValueChange={(v) => onUpdate?.({ price: v })}
                      placeholder='0.00'
                      className='text-foreground font-extrabold text-xl placeholder:text-muted-foreground'
                      style={inputStyles.price}
                      onFocus={() => onTextFocusChange?.(true)}
                      onBlur={() => onTextFocusChange?.(false)}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ── Top layer: Claim mode card (fades out when entering edit, in when leaving) ── */}
            <Animated.View
              pointerEvents={isEditMode ? 'none' : 'auto'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                opacity: claimAnim,
              }}
            >
              <Pressable
                onPress={onToggleSelect}
                className='w-full bg-card rounded-2xl p-4'
              >
                {/* Inset selection border — fades in/out */}
                <Animated.View
                  className='absolute inset-0 rounded-2xl border-2 border-primary'
                  style={{ opacity: selectAnim }}
                  pointerEvents='none'
                />
                <View className='flex-row items-center'>
                  {/* Selection indicator — crossfade between icons */}
                  <View className='w-10 h-10 items-center justify-center mr-3'>
                    <Animated.View
                      style={{ position: 'absolute', opacity: selectAnim }}
                    >
                      <MaterialCommunityIcons
                        name='dots-grid'
                        size={26}
                        color='#4999DF'
                      />
                    </Animated.View>
                    <Animated.View style={{ opacity: deSelectAnim }}>
                      <MaterialCommunityIcons
                        name='circle-outline'
                        size={26}
                        color='#4999DF'
                      />
                    </Animated.View>
                  </View>

                  {/* Item name */}
                  <Text
                    className='text-foreground font-extrabold text-xl flex-1 mr-2'
                    numberOfLines={1}
                  >
                    {item.name || 'Unnamed Item'}
                  </Text>

                  {/* Price */}
                  <Text className='text-foreground font-extrabold text-xl'>
                    ${parseFloat(item.price || '0').toFixed(2)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* ── Shared user tags (animate their own edit/claim appearance) ── */}
            {allDisplayTagIds.length > 0 && (
              <View
                style={{ position: 'absolute', top: 49, left: 52 }}
                className='flex-row flex-wrap items-start justify-start gap-1 -ml-2 right-10'
              >
                {allDisplayTagIds.map((userId) => (
                  <UserTag
                    key={userId}
                    id={userId}
                    onRemove={() => onRemoveFromUser(userId)}
                    isEntering={enteringTagIds.has(userId)}
                    isExiting={exitingTagIds.has(userId)}
                    isEditMode={isEditMode}
                    accentColor={participantColors?.[userId]}
                    canRemove={
                      removableTagIds === undefined
                        ? true
                        : removableTagIds.has(userId)
                    }
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
