import { IconButton as I } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { COLORS, type ColorName } from '../constants/colors';

export interface IconButtonProps {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: ColorName;
  size: ComponentProps<typeof I>['size'];
  containerColor?: ColorName;
  mode?: ComponentProps<typeof I>['mode'];
  onPress?: ComponentProps<typeof I>['onPress'];
}

export function IconButton({
  icon,
  iconColor,
  size,
  containerColor,
  mode,
  onPress,
}: IconButtonProps) {
  return (
    <I
      icon={icon}
      iconColor={COLORS[iconColor]}
      size={size}
      containerColor={containerColor ? COLORS[containerColor] : undefined}
      mode={mode}
      onPress={onPress}
    />
  );
}
