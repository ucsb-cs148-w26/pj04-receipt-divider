# `useScrollToInput` & `ScrollableTextInput` — How-to-use

Automatically scrolls a focused `TextInput` to the vertical centre of the screen, keeping it visible above the software keyboard on both iOS and Android.

---

## Overview

| Export | Kind | Location |
|---|---|---|
| `useScrollToInput` | React hook | `shared/src/hooks/useScrollToInput.ts` |
| `SCROLL_TO_INPUT_BOTTOM_PADDING` | constant | same file |
| `ScrollToInputContext` | TypeScript type | same file |
| `ScrollableTextInput` | React component | `shared/src/components/ScrollableTextInput.tsx` |

Both are re-exported from `@eezy-receipt/shared`.

---

## Quick start

```tsx
import { useScrollToInput, ScrollableTextInput } from '@eezy-receipt/shared';
import { Animated } from 'react-native';

export default function MyScreen() {
  const ctx = useScrollToInput({ resetOnBlur: true });

  return (
    <Animated.ScrollView
      ref={ctx.scrollViewRef}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: someAnimatedValue } } }],
        {
          useNativeDriver: true,
          listener: (e) => ctx.trackScrollOffset(e),
        },
      )}
      scrollEventThrottle={16}
      onContentSizeChange={ctx.onContentSizeChange}
      contentContainerStyle={{ paddingBottom: ctx.bottomPadding }}
    >
      <ScrollableTextInput
        scrollContext={ctx}
        name="email"
        placeholder="Email"
      />
      <ScrollableTextInput
        scrollContext={ctx}
        name="password"
        secureTextEntry
        placeholder="Password"
      />
    </Animated.ScrollView>
  );
}
```

---

## `useScrollToInput`

### Signature

```ts
function useScrollToInput(options?: UseScrollToInputOptions): ScrollToInputContext
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `resetOnBlur` | `boolean` | `false` | When `true`, the scroll view animates back to `y=0` and the bottom padding collapses to `0` when the keyboard hides. When `false`, the scroll position stays wherever it ended up and the padding is always present. |

### Returned context (`ScrollToInputContext`)

| Property | Type | Wire it to… |
|---|---|---|
| `scrollViewRef` | `RefObject<ScrollView>` | `ref` prop of the `ScrollView` / `Animated.ScrollView` |
| `trackScrollOffset` | `(e) => void` | `listener` inside `Animated.event` **or** directly as `onScroll` when not using `Animated.event` |
| `scrollToInput` | `(inputRef, name?) => void` | Called automatically by `ScrollableTextInput`; use manually if you need a plain `TextInput` |
| `bottomPadding` | `Animated.Value` | `paddingBottom` inside `contentContainerStyle` |
| `onContentSizeChange` | `() => void` | `onContentSizeChange` prop of the `ScrollView` |

> **Important — `paddingBottom`:** The scroll view must have enough overflow to actually scroll. Without it `scrollTo()` is silently ignored. Always pass `ctx.bottomPadding` to `contentContainerStyle.paddingBottom`. When `resetOnBlur` is `true` the value automatically collapses to `0` once the keyboard is gone.

> **Important — `onContentSizeChange`:** On the very first focus (when `resetOnBlur: true`), padding jumps from `0` to `SCROLL_TO_INPUT_BOTTOM_PADDING` and the native layout pass hasn't finished yet. The hook defers the scroll until `onContentSizeChange` fires, so this prop is required for the first-focus case to work correctly.

### `SCROLL_TO_INPUT_BOTTOM_PADDING`

```ts
export const SCROLL_TO_INPUT_BOTTOM_PADDING = Dimensions.get('window').height * 0.5;
```

Half the screen height worth of extra space added below the last item. Enough to always allow the scroll view to scroll any input into view. Import it if you need to reference the value in your own layout calculations.

---

## `ScrollableTextInput`

A drop-in replacement for React Native's `TextInput`. It owns its own internal ref and calls `ctx.scrollToInput` on focus automatically — no ref management required in the parent.

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `scrollContext` | `ScrollToInputContext` | Yes | The object returned by `useScrollToInput`. |
| `name` | `string` | No | Label shown in debug logs to distinguish inputs. Defaults to `'input'`. |
| …all `TextInputProps` | — | — | Every standard `TextInput` prop is forwarded. |

### Example

```tsx
<ScrollableTextInput
  scrollContext={ctx}
  name="email"
  autoCapitalize="none"
  keyboardType="email-address"
  placeholder="Email"
  value={email}
  onChangeText={setEmail}
/>
```

---

## Using a plain `TextInput` (manual mode)

If you cannot use `ScrollableTextInput`, call `ctx.scrollToInput` yourself inside `onFocus`:

```tsx
const inputRef = useRef<TextInput>(null);

<TextInput
  ref={inputRef}
  onFocus={() => ctx.scrollToInput(inputRef, 'myInput')}
  ...
/>
```

---

## `resetOnBlur` — when to use which value

| Scenario | `resetOnBlur` |
|---|---|
| Form sits near the top; content above looks fine after dismissal | `true` |
| Long scrollable page; users expect to stay where they scrolled | `false` (default) |

---

## Animated vs plain `ScrollView`

The hook works with both. When combining with another `Animated.event` for scroll-based animations (e.g. a shrinking header), pass `ctx.trackScrollOffset` as the `listener` callback so the hook stays in sync:

```tsx
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
  {
    useNativeDriver: true,
    listener: (e) => ctx.trackScrollOffset(e),
  },
)}
```

When you have no other animated value to track, pass `ctx.trackScrollOffset` directly:

```tsx
<ScrollView
  ref={ctx.scrollViewRef}
  onScroll={ctx.trackScrollOffset}
  scrollEventThrottle={16}
  onContentSizeChange={ctx.onContentSizeChange}
  contentContainerStyle={{ paddingBottom: ctx.bottomPadding }}
>
```

---

## Full checklist

- [ ] Call `useScrollToInput` once per screen (not per input).
- [ ] Pass `ref={ctx.scrollViewRef}` to the `ScrollView`.
- [ ] Call `ctx.trackScrollOffset` on every scroll event.
- [ ] Add `onContentSizeChange={ctx.onContentSizeChange}`.
- [ ] Set `contentContainerStyle={{ paddingBottom: ctx.bottomPadding }}`.
- [ ] Use `<ScrollableTextInput scrollContext={ctx} ... />` instead of `<TextInput>`.
