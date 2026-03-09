import React, { useRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import type { ScrollToInputContext } from '../hooks/useScrollToInput';

interface ScrollableTextInputProps extends TextInputProps {
  /** Return value of useScrollToInput passed down from the parent ScrollView owner. */
  scrollContext: ScrollToInputContext;
  /** Label used in debug logs. Defaults to 'input'. */
  name?: string;
}

/**
 * Drop-in replacement for TextInput that automatically scrolls itself to the
 * vertical centre of the screen when focused, using the scroll context
 * provided by useScrollToInput.
 *
 * No ref management required in the parent — the ref is owned internally.
 *
 * Usage:
 *   const ctx = useScrollToInput({ resetOnBlur: true });
 *   <ScrollableTextInput scrollContext={ctx} name='email' placeholder='Email' ... />
 */
export function ScrollableTextInput({
  scrollContext,
  name,
  onFocus,
  ...props
}: ScrollableTextInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <TextInput
      ref={inputRef}
      onFocus={(e) => {
        scrollContext.scrollToInput(inputRef, name);
        onFocus?.(e);
      }}
      {...props}
    />
  );
}
