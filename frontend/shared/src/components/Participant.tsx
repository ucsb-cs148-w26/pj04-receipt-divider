import { USER_COLORS } from '@shared/constants';
import { useRef } from 'react';
import { View, Text, LayoutRectangle, Pressable, Alert } from 'react-native';

interface ParticipantsProps {
  id: number;
  name?: string;
  itemCount?: number;
  totalAmount?: string;
  onRemove: () => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
  isEditMode?: boolean;
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
}: ParticipantsProps) {
  const ref = useRef<View>(null);
  const displayName = name || `Name ${id}`;

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
      style={{ width: 160 }}
      onPress={goToYourItemsPage}
    >
      {/* Colored top strip */}
      <View
        className={`h-2 bg-${USER_COLORS[(id - 1) % USER_COLORS.length]}`}
      />

      <View className='px-3 py-3'>
        <View className='flex-row items-center gap-3'>
          {/* User ID circle */}
          <View
            className={`w-9 h-9 rounded-full items-center justify-center bg-${USER_COLORS[(id - 1) % USER_COLORS.length]}`}
          >
            <Text className='text-white text-sm font-bold'>{id}</Text>
          </View>

          {/* Name */}
          <Text
            className='text-foreground font-bold text-sm flex-1'
            numberOfLines={1}
          >
            {displayName}
          </Text>
        </View>

        {/* Item count and total */}
        <View className='flex-row items-center justify-between mt-2'>
          <Text className='text-muted-foreground text-xs'>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · ${totalAmount}
          </Text>
          <Text className='text-muted-foreground text-base'>›</Text>
        </View>
      </View>

      {/* Remove button - only in edit mode */}
      {isEditMode && (
        <Pressable
          className='absolute top-1 right-1 bg-destructive w-5 h-5 rounded-full items-center justify-center z-10'
          onPress={confirmRemove}
          hitSlop={{ top: 10, bottom: 10, right: 10, left: 10 }}
        >
          <Text className='text-white text-xs font-bold'>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
