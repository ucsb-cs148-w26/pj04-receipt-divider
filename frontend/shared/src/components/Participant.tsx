import { USER_COLORS } from '@shared/constants';
import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  LayoutRectangle,
  Pressable,
  Alert,
  Animated,
} from 'react-native';

interface ParticipantsProps {
  id: number;
  name?: string;
  itemCount?: number;
  totalAmount?: string;
  onRemove: () => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
  isEditMode?: boolean;
  /** If false, the remove button is hidden (real/registered users cannot be removed) */
  isGuest?: boolean;
  /** Hex accent color to override the default avatar-X palette color */
  accentColor?: string;
}

export function Participant({
  id,
  name,
  itemCount = 0,
  totalAmount = '0.00',
  onRemove,
  onLayout,
  goToYourItemsPage,
  isEditMode = true,
  isGuest = true,
  accentColor,
}: ParticipantsProps) {
  const ref = useRef<View>(null);
  const displayName = name || `Name ${id}`;

  const editAnim = useRef(new Animated.Value(isEditMode ? 1 : 0)).current;
  // For guests: number fades out when ✕ fades in. For non-guests: number always visible.
  const numberOpacity = isGuest
    ? editAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
    : 1;

  useEffect(() => {
    Animated.timing(editAnim, {
      toValue: isEditMode ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmRemove = () => {
    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove "${displayName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ],
    );
  };

  return (
    <Pressable
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onLayout({ x, y, width, height });
        });
      }}
      className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10'
      style={{ width: 160, height: 100 }}
      onPress={goToYourItemsPage}
    >
      {/* Colored top strip */}
      <View
        className={
          accentColor
            ? 'h-3'
            : `h-3 bg-${USER_COLORS[(id - 1) % USER_COLORS.length]}`
        }
        style={
          accentColor ? { height: 12, backgroundColor: accentColor } : undefined
        }
      />

      <View className='px-3 py-3 flex-1 justify-between'>
        <View className='flex-row items-center gap-3'>
          {/* User ID circle — cross-fades ✕ (edit, guests only) ↔ number (claim) */}
          <Pressable
            className={`w-9 h-9 rounded-full items-center justify-center ${accentColor ? '' : `bg-${USER_COLORS[(id - 1) % USER_COLORS.length]}`} ${isEditMode && isGuest ? 'active:opacity-70' : ''}`}
            style={accentColor ? { backgroundColor: accentColor } : undefined}
            onPress={isEditMode && isGuest ? confirmRemove : undefined}
            accessibilityLabel={
              isEditMode && isGuest ? 'Remove participant' : undefined
            }
            hitSlop={
              isEditMode && isGuest
                ? { top: 10, bottom: 10, right: 10, left: 10 }
                : undefined
            }
          >
            <Animated.View
              style={{ position: 'absolute', opacity: isGuest ? editAnim : 0 }}
            >
              <Text className='text-white text-sm font-bold'>✕</Text>
            </Animated.View>
            <Animated.View style={{ opacity: numberOpacity }}>
              <Text className='text-white text-sm font-bold'>{id}</Text>
            </Animated.View>
          </Pressable>

          {/* Name */}
          <Text
            className='text-foreground font-bold text-sm flex-1'
            numberOfLines={2}
          >
            {displayName}
          </Text>
        </View>

        {/* Item count and total */}
        <View className='flex-row items-center justify-between'>
          <Text className='text-muted-foreground text-xs'>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · ${totalAmount}
          </Text>
          <Text className='text-muted-foreground text-base'>›</Text>
        </View>
      </View>
    </Pressable>
  );
}
