import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import type { RefObject } from 'react';

const SCREEN_H = Dimensions.get('window').height;

/**
 * The full bottom-padding value needed to make the ScrollView scrollable.
 * Always use this when resetOnBlur is false.
 * When resetOnBlur is true, use the bottomPadding returned by the hook instead
 * — it automatically drops to 0 when the keyboard is hidden.
 */
export const SCROLL_TO_INPUT_BOTTOM_PADDING = SCREEN_H * 0.5;

interface UseScrollToInputOptions {
  /**
   * When true:
   *  - The scroll view animates back to y=0 when the keyboard is dismissed.
   *  - bottomPadding is SCROLL_TO_INPUT_BOTTOM_PADDING while the keyboard is
   *    open, and 0 once it's hidden (removes dead space when not editing).
   * When false (default):
   *  - Scroll position is kept wherever it ended up.
   *  - bottomPadding is always SCROLL_TO_INPUT_BOTTOM_PADDING.
   */
  resetOnBlur?: boolean;
}

/**
 * Hook that provides scroll-to-center-on-focus behaviour for TextInputs
 * inside a ScrollView.
 *
 * Usage:
 *   const ctx = useScrollToInput({ resetOnBlur: true });
 *
 *   <ScrollView
 *     ref={ctx.scrollViewRef}
 *     onScroll={(e) => ctx.trackScrollOffset(e)}
 *     contentContainerStyle={{ paddingBottom: ctx.bottomPadding }}
 *   >
 *     <ScrollableTextInput scrollContext={ctx} name='email' ... />
 *   </ScrollView>
 */
export function useScrollToInput({
  resetOnBlur = false,
}: UseScrollToInputOptions = {}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  // Animated value drives paddingBottom on the ScrollView's contentContainerStyle.
  // resetOnBlur=false: always at full padding (always scrollable).
  // resetOnBlur=true:  starts at 0, jumps to full synchronously on focus so that
  //   scrollTo() always has overflow to work with, then animates back to 0 on hide.
  const bottomPadding = useRef(
    new Animated.Value(resetOnBlur ? 0 : SCROLL_TO_INPUT_BOTTOM_PADDING),
  ).current;
  // Deferred-scroll state: when padding jumps 0→FULL the native layout hasn't
  // committed yet, so scrollTo is a no-op. We store the target Y here and
  // execute it in onContentSizeChange once the ScrollView has actually re-laid-out.
  const pendingScrollRef = useRef<number | null>(null);
  const paddingExpandedRef = useRef(!resetOnBlur);

  useEffect(() => {
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onHide = Keyboard.addListener(hideEvent, () => {
      console.log('[useScrollToInput] keyboard hidden');
      pendingScrollRef.current = null; // cancel any deferred scroll
      if (resetOnBlur) {
        paddingExpandedRef.current = false;
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        Animated.timing(bottomPadding, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => onHide.remove();
  }, [resetOnBlur, bottomPadding]);

  /** Call this inside the ScrollView's onScroll (or Animated.event listener) to
   *  keep the hook's internal offset in sync. */
  const trackScrollOffset = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  };

  /**
   * Scroll so that the focused input is vertically centred on screen.
   * Prefer using ScrollableTextInput which calls this automatically.
   *
   * @param inputRef  ref attached to the TextInput
   * @param name      optional label used in debug logs
   */
  const scrollToInput = (
    inputRef: RefObject<TextInput | null>,
    name = 'input',
  ) => {
    console.log(
      `[useScrollToInput] "${name}" focused  scrollOffset=${scrollOffsetRef.current}`,
    );
    if (!inputRef.current) {
      console.warn(
        `[useScrollToInput] ref for "${name}" is null — make sure ref is attached to the TextInput`,
      );
      return;
    }
    // Step 1: measure the input's current screen position BEFORE anything changes.
    // This must happen first so we capture the pre-keyboard Y coordinate.
    inputRef.current.measureInWindow(
      (_x: number, y: number, _w: number, height: number) => {
        console.log(
          `[useScrollToInput] measureInWindow → screenY=${y}  inputH=${height}  SCREEN_H=${SCREEN_H}`,
        );
        const targetScreenY = SCREEN_H / 2 - height / 2;
        const delta = y - targetScreenY;
        const newScrollY = Math.max(0, scrollOffsetRef.current + delta);
        console.log(
          `[useScrollToInput] targetScreenY=${targetScreenY}  delta=${delta}  → scrollTo(${newScrollY})`,
        );

        // Ensure overflow exists so scrollTo has room to scroll into.
        bottomPadding.stopAnimation(); // cancel any in-progress collapse animation
        bottomPadding.setValue(SCROLL_TO_INPUT_BOTTOM_PADDING);

        if (paddingExpandedRef.current) {
          // Overflow already existed before this focus — scroll immediately.
          scrollViewRef.current?.scrollTo({ y: newScrollY, animated: true });
        } else {
          // Padding just jumped 0 → FULL. The native layout pass hasn't committed
          // yet, so scrollTo would be a silent no-op (ScrollView has no overflow).
          // Defer until onContentSizeChange fires — that event is dispatched after
          // native has re-laid-out the ScrollView with the new paddingBottom.
          paddingExpandedRef.current = true;
          pendingScrollRef.current = newScrollY;
        }
      },
    );
  };

  /** Wire this to the ScrollView's onContentSizeChange prop so deferred
   *  scrolls (first-focus with resetOnBlur) execute after native layout commits. */
  const onContentSizeChange = () => {
    if (pendingScrollRef.current !== null) {
      const y = pendingScrollRef.current;
      pendingScrollRef.current = null;
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }
  };

  // When resetOnBlur: padding is only needed while the keyboard is open.
  // When !resetOnBlur: always keep the overflow so the user can scroll freely.
  // bottomPadding is an Animated.Value — pass it directly to contentContainerStyle
  // on an Animated.ScrollView so it transitions smoothly.

  return {
    scrollViewRef,
    trackScrollOffset,
    scrollToInput,
    bottomPadding,
    onContentSizeChange,
  };
}

/**
 * Type of the context object returned by useScrollToInput.
 * Pass this as the scrollContext prop of ScrollableTextInput, or use it to
 * type props/state when threading the context through multiple components.
 */
export type ScrollToInputContext = ReturnType<typeof useScrollToInput>;
