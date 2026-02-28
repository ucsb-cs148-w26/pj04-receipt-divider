import React, { useState } from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { twMerge } from 'tailwind-merge';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: (event: any) => void;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  outlined: 'border border-primary bg-transparent',
  text: 'bg-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  small: 'py-1.5 px-3',
  medium: 'py-2.5 px-4',
  large: 'py-3.5 px-5',
};

const variantTextClasses: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outlined: 'text-primary',
  text: 'text-primary',
};

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  onPress,
  className = '',
  textClassName = '',
  children,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withSpring(pressed ? 0.6 : 1, {
      damping: 2000,
      stiffness: 8000,
    }),
  }));

  return (
    <AnimatedPressable
      style={fadeStyle}
      className={twMerge(
        `rounded-lg justify-center items-center ${variantClasses[variant]} ${sizeClasses[size]}${disabled ? ' opacity-60' : ''} ${className}`,
      )}
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole='button'
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          className={`${variant === 'primary' || variant === 'secondary' ? 'text-primary-foreground' : 'text-primary'}`}
        />
      ) : (
        <Text className={twMerge(variantTextClasses[variant], textClassName)}>
          {children}
        </Text>
      )}
    </AnimatedPressable>
  );
}
