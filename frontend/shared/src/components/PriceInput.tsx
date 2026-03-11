import {
  LayoutAnimation,
  Platform,
  StyleProp,
  TextStyle,
  UIManager,
} from 'react-native';
import { ScrollableTextInput } from './ScrollableTextInput';
import type { ScrollToInputContext } from '../hooks/useScrollToInput';

// Enable LayoutAnimation on Android at module-load time (no-op on iOS).
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const LAYOUT_ANIM = {
  duration: 80,
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

interface PriceInputProps {
  value: string;
  /** Called with every validated change AND after blur formatting (toFixed(2)). */
  onValueChange: (_v: string) => void;
  /** Maximum allowed numeric value. Defaults to 99999.99. */
  max?: number;
  onFocus?: () => void;
  /** Called after the blur value has been formatted and committed. */
  onBlur?: () => void;
  scrollContext?: ScrollToInputContext;
  name?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  className?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * Shared numeric input for prices and percentages.
 *
 * - Strips non-digit/dot characters
 * - Caps value at `max` (default 99999.99)
 * - Formats to 2 decimal places on blur — fires LayoutAnimation so the resize
 *   is always animated even when triggered by blur (fixes numbers being clipped)
 * - selectTextOnFocus is always enabled
 */
export function PriceInput({
  value,
  onValueChange,
  max = 99999.99,
  onFocus,
  onBlur,
  scrollContext,
  name,
  placeholder,
  placeholderTextColor,
  className,
  style,
  numberOfLines = 1,
}: PriceInputProps) {
  const handleChange = (v: string) => {
    const numeric = v.replace(/[^\d.]/g, '');
    const parsed = parseFloat(numeric);
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    if (!isNaN(parsed) && parsed > max) {
      // Preserve the same decimal style as the cap value itself.
      onValueChange(max % 1 === 0 ? String(max) : max.toFixed(2));
    } else {
      onValueChange(numeric);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(value || '0');
    // Animate the layout to the formatted (potentially wider) value before
    // the re-render — this is what prevents clipping after blur.
    LayoutAnimation.configureNext(LAYOUT_ANIM);
    onValueChange(isNaN(parsed) ? '0.00' : parsed.toFixed(2));
    onBlur?.();
  };

  return (
    <ScrollableTextInput
      scrollContext={scrollContext}
      name={name}
      value={value}
      onChangeText={handleChange}
      onFocus={onFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      className={className}
      style={style}
      numberOfLines={numberOfLines}
      keyboardType='decimal-pad'
      selectTextOnFocus
    />
  );
}
