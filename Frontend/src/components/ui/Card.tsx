import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, radius, spacing, shadows } from '../../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, onPress, padded = true, elevated = true }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const content = (
    <View
      style={[
        styles.card,
        elevated && shadows.sm,
        !elevated && styles.flatCard,
        padded && styles.padded,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.95}
          accessibilityRole="button"
        >
          {content}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flatCard: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  padded: {
    padding: spacing.lg,
  },
});
