import { Pressable, LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';

export type IconButtonProps = {
  /**
   * Name of the icon from MaterialCommunityIcons. See https://icons.expo.fyi/ with the `MaterialCommunityIcons` filter turned on for available icons.
   */
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  className?: string;
  onPress?: () => void;
  percentageSize?: number;
  color?: string;
  /**
   * `fade`: reduces opacity to 60% when pressed
   *
   * `overlay`: adds a gray overlay with 40% opacity when pressed
   *
   * `scale`: scales down the button to 92% when pressed
   */
  pressEffect?: 'fade' | 'overlay' | 'scale';
};

export function IconButton({
  icon,
  className,
  onPress,
  percentageSize = 60,
  color = '#000',
  pressEffect,
}: IconButtonProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [pressed, setPressed] = useState(false);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withSpring(pressed ? 0.6 : 1, {
      damping: 2000, // Higher = slower, less bouncy (default: 10)
      stiffness: 8000, // Higher = faster, more bouncy (default: 100)
    }),
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: withSpring(pressed ? 0.4 : 0, {
      damping: 2000, // Higher = slower, less bouncy (default: 10)
      stiffness: 8000, // Higher = faster, more bouncy (default: 100)
    }),
  }));
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(pressed ? 0.92 : 1, {
          damping: 2000, // Higher = slower, less bouncy (default: 10)
          stiffness: 8000, // Higher = faster, more bouncy (default: 100)
        }),
      },
    ],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const iconSize = (containerWidth * percentageSize) / 100;

  return (
    <Animated.View
      style={
        pressEffect === undefined || pressEffect === 'overlay'
          ? undefined
          : pressEffect === 'fade'
            ? fadeStyle
            : scaleStyle
      }
    >
      <Pressable
        className={
          `items-center justify-center rounded-full shadow-md shadow-black/15 ` +
          className
        }
        onLayout={handleLayout}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
      >
        <Animated.View
          style={pressEffect === 'overlay' ? overlayStyle : undefined}
          className={
            pressEffect === 'overlay' ? 'bg-gray-500 absolute inset-0' : ''
          }
        ></Animated.View>
        <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
      </Pressable>
    </Animated.View>
  );
}

export type ReusableButtonProps = {
  onPress: () => void;
};

export function SettingsButton({ onPress }: ReusableButtonProps) {
  return (
    <IconButton
      icon='cog-outline'
      percentageSize={60}
      color='#848484'
      pressEffect='overlay'
      onPress={onPress}
      className='bg-white size-[12vw]'
    />
  );
}

export function CloseButton({ onPress }: ReusableButtonProps) {
  return (
    <IconButton
      icon='close'
      percentageSize={60}
      color='#848484'
      pressEffect='overlay'
      onPress={onPress}
      className='bg-white size-[12vw]'
    />
  );
}
