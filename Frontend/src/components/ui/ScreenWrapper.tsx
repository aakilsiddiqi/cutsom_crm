import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

interface ScreenWrapperProps {
  children: React.ReactNode;
  noTopInset?: boolean;
  noBottomInset?: boolean;
  bg?: string;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  noTopInset = false,
  noBottomInset = false,
  bg = colors.bg,
}) => (
  <SafeAreaView
    style={[styles.container, { backgroundColor: colors.headerBg }]}
    edges={noTopInset ? ['bottom'] : noBottomInset ? ['top'] : undefined}
  >
    <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
    <View style={[styles.content, { backgroundColor: bg }]}>
      {children}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
