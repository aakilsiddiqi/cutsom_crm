import React, { useState, useRef } from 'react';
import { View, TextInput, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, radius, spacing } from '../../theme/tokens';
import { Icon } from './Icon';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  secureTextEntry?: boolean;
  multiline?: boolean;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'search' | 'go';
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  multiline,
  error,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  onSubmitEditing,
  returnKeyType,
}) => {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    if (!value) {
      Animated.timing(focusAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  };

  const labelTop = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -8],
  });

  const labelScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  const borderColor = error
    ? colors.borderError
    : focused
    ? colors.borderFocus
    : colors.border;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { borderColor }, multiline && styles.multilineContainer]}>
        {icon && (
          <Icon
            name={icon}
            size={18}
            color={focused ? colors.info : colors.textTertiary}
          />
        )}
        <View style={[styles.inputWrapper, icon && { marginLeft: spacing.sm }]}>
          <Animated.Text
            style={[
              styles.label,
              {
                top: labelTop,
                transform: [{ scale: labelScale }],
                color: error ? colors.error : focused ? colors.info : colors.textSecondary,
              },
            ]}
          >
            {label}
          </Animated.Text>
          <TextInput
            style={[
              styles.input,
              multiline && styles.multilineInput,
              icon && { marginLeft: 0 },
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={focused ? placeholder : undefined}
            placeholderTextColor={colors.textTertiary}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            maxLength={maxLength}
            onSubmitEditing={onSubmitEditing}
            returnKeyType={returnKeyType}
            accessibilityLabel={label}
          />
        </View>
      </View>
      {error && (
        <Text style={styles.error} allowFontScaling={false}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 52,
  },
  multilineContainer: {
    minHeight: 80,
    alignItems: 'flex-start',
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 0,
    ...typography.body,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    zIndex: 1,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingTop: 8,
    paddingBottom: 0,
    zIndex: 2,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  error: {
    ...typography.caption1,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
