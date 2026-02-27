import { Pressable, LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { cssInterop } from 'nativewind';

/**Usage: https://github.com/nativewind/nativewind/issues/614 */
cssInterop(MaterialCommunityIcons, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: 'color', width: 'size' },
  },
});

export type IconButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  bgClassName?: string;
  iconClassName?: string;
  text?: string;
  textClassName?: string;
  pressEffect?: 'fade' | 'overlay' | 'scale';
  onPress?: () => void;
};

export function IconButton({
  /**
   * Name of the icon from MaterialCommunityIcons. See https://icons.expo.fyi/ with the `MaterialCommunityIcons` filter turned on for available icons.
   */
  icon,
  bgClassName = '',
  iconClassName = '',
  /**
   * Optional text to display after the icon
   */
  text = '',
  textClassName = '',
  /**
   * `fade`: reduces opacity to 60% when pressed
   *
   * `overlay`: adds a gray overlay with 40% opacity when pressed
   *
   * `scale`: scales down the button to 92% when pressed
   */
  pressEffect = 'fade',
  onPress,
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

  // Extract rounded class from className, or default to 'rounded-full'
  const roundedClass = bgClassName?.match(/rounded-\S+/)?.[0] || 'rounded-full';

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
        className={twMerge(
          `flex-row items-center justify-center rounded-full shadow-md shadow-black/15 size-[12vw] bg-card`,
          bgClassName,
        )}
        onLayout={handleLayout}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
      >
        <Animated.View
          style={pressEffect === 'overlay' ? overlayStyle : undefined}
          className={twMerge(
            pressEffect === 'overlay'
              ? `bg-gray-500 absolute inset-0 ${roundedClass}`
              : '',
          )}
        ></Animated.View>
        <MaterialCommunityIcons
          name={icon}
          className={twMerge(
            'text-muted-foreground size-[7.2vw] ' + iconClassName,
          )}
        />
        {text && (
          <Text
            className={twMerge(
              `ml-2 text-[7.2vw] text-foreground ${textClassName}`,
            )}
          >
            {text}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export type DefaultDefaultButtonProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconClassName?: string;
  onPress?: () => void;
};
export type DefaultButtonProps = {
  onPress: () => void;
};

export class DefaultButtons {
  static Default({ icon, iconClassName, onPress }: DefaultDefaultButtonProps) {
    return (
      <IconButton
        icon={icon}
        pressEffect='overlay'
        onPress={onPress}
        iconClassName={iconClassName}
      />
    );
  }

  static Settings({ onPress }: DefaultButtonProps) {
    return (
      <View className='absolute top-[6vh] right-[4vw]'>
        <IconButton
          icon='cog-outline'
          pressEffect='overlay'
          onPress={onPress}
        />
      </View>
    );
  }

  static Close({ onPress }: DefaultButtonProps) {
    return (
      <View className='absolute top-[6vh] left-[4vw]'>
        <IconButton icon='close' pressEffect='overlay' onPress={onPress} />
      </View>
    );
  }
}
