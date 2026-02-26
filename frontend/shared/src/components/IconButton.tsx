import { Pressable, LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';

export type IconButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  className?: string;
  onPress?: () => void;
  percentageSize?: number;
  color?: string;
  text?: string;
  textPercentageSize?: number;
  textColor?: string;
  pressEffect?: 'fade' | 'overlay' | 'scale';
};

export function IconButton({
  /**
   * Name of the icon from MaterialCommunityIcons. See https://icons.expo.fyi/ with the `MaterialCommunityIcons` filter turned on for available icons.
   */
  icon,
  /**
   * Make sure to include a size class (`size-`, `w-`/`h-`, or `width-`/`height-`). Otherwise the button won't be visible.
   */
  className,
  onPress,
  percentageSize = 60,
  color = '#000',
  /**
   * Optional text to display after the icon
   */
  text,
  /**
   * Font size for the text (default: matches icon size)
   */
  textPercentageSize,
  /**
   * Color for the text (default: matches icon color)
   */
  textColor,
  /**
   * `fade`: reduces opacity to 60% when pressed
   *
   * `overlay`: adds a gray overlay with 40% opacity when pressed
   *
   * `scale`: scales down the button to 92% when pressed
   */
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
  const textSize =
    textPercentageSize !== undefined
      ? (containerWidth * textPercentageSize) / 100
      : iconSize;

  // Extract rounded class from className, or default to 'rounded-full'
  const roundedClass = className?.match(/rounded-\S+/)?.[0] || 'rounded-full';

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
          `flex-row items-center justify-center rounded-full shadow-md shadow-black/15 ` +
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
            pressEffect === 'overlay'
              ? `bg-gray-500 absolute inset-0 ${roundedClass}`
              : ''
          }
        ></Animated.View>
        <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
        {text && (
          <Text style={{ fontSize: textSize, color: textColor || color }}>
            {text}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export type DefaultDefaultButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void;
};
export type DefaultButtonProps = {
  onPress: () => void;
};

export class DefaultButtons {
  static Default({ icon, onPress }: DefaultDefaultButtonProps) {
    return (
      <IconButton
        icon={icon}
        percentageSize={60}
        color='#848484'
        pressEffect='overlay'
        onPress={onPress}
        className='bg-white size-[12vw]'
      />
    );
  }

  static Settings({ onPress }: DefaultButtonProps) {
    return (
      <View className='absolute top-[6vh] right-[4vw]'>
        <IconButton
          icon='cog-outline'
          percentageSize={60}
          color='#848484'
          pressEffect='overlay'
          onPress={onPress}
          className='bg-white size-[12vw]'
        />
      </View>
    );
  }

  static Close({ onPress }: DefaultButtonProps) {
    return (
      <View className='absolute top-[6vh] left-[4vw]'>
        <IconButton
          icon='close'
          percentageSize={60}
          color='#848484'
          pressEffect='overlay'
          onPress={onPress}
          className='bg-white size-[12vw]'
        />
      </View>
    );
  }
}
