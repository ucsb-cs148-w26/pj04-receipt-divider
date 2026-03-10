import { USER_COLORS } from '@shared/constants';
import React from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING_CONFIG = {
  damping: 2000,
  stiffness: 8000,
};

export function UserTag({
  id,
  onRemove,
  isEntering = false,
  isExiting = false,
  isEditMode = true,
}: {
  id: number;
  onRemove: () => void;
  isEntering?: boolean;
  isExiting?: boolean;
  isEditMode?: boolean;
}) {
  const scale = useSharedValue(isEntering ? 0 : 1);
  const editOpacity = useSharedValue(isEditMode ? 1 : 0);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const editStyle = useAnimatedStyle(() => ({
    opacity: editOpacity.value,
  }));

  const claimStyle = useAnimatedStyle(() => ({
    opacity: 1 - editOpacity.value,
  }));

  // Pop-in
  React.useEffect(() => {
    if (isEntering) {
      scale.value = 0;
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [isEntering]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pop-out
  React.useEffect(() => {
    if (isExiting) {
      scale.value = withSpring(0, SPRING_CONFIG);
    }
  }, [isExiting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit/claim mode fade
  React.useEffect(() => {
    editOpacity.value = withTiming(isEditMode ? 1 : 0, { duration: 200 });
  }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={scaleStyle}>
      <Pressable
        onPress={isEditMode ? onRemove : undefined}
        className={`bg-${USER_COLORS[(id - 1) % USER_COLORS.length]} px-1 h-[25px] w-[28px] py-1 rounded-md justify-center items-center shadow-sm`}
        accessibilityLabel={
          isEditMode ? `Tap to remove user ${id}` : `Claimed by user ${id}`
        }
      >
        <Animated.View style={[{ position: 'absolute' }, editStyle]}>
          <Text className='text-white text-sm font-bold'>✕</Text>
        </Animated.View>
        <Animated.View style={claimStyle}>
          <Text className='text-white text-sm font-bold'>{id}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
