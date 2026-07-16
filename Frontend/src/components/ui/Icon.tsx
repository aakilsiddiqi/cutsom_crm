import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#1C1C1E', accessibilityLabel }) => (
  <Ionicons
    name={name}
    size={size}
    color={color}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="image"
  />
);
