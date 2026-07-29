import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withErrorBoundary } from '../components/ErrorBoundary';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AllJobsScreen } from '../screens/admin/AllJobsScreen';
import { TeamScreen } from '../screens/admin/TeamScreen';
import { JobDetailAdminScreen } from '../screens/admin/JobDetailAdminScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { AddTechnicianScreen } from '../screens/admin/AddTechnicianScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { CreateJobSheetScreen } from '../screens/user/CreateJobSheetScreen';
import { RevenueDashboardScreen } from '../screens/revenue/RevenueDashboardScreen';
import { RevenueTransactionsScreen } from '../screens/revenue/RevenueTransactionsScreen';
import { RevenueTransactionFormScreen } from '../screens/revenue/RevenueTransactionFormScreen';
import { RevenueTransactionDetailScreen } from '../screens/revenue/RevenueTransactionDetailScreen';
import { OutstandingCustomersScreen } from '../screens/revenue/OutstandingCustomersScreen';
import { CustomerDetailScreen } from '../screens/revenue/CustomerDetailScreen';
import { AdminStackParamList } from '../types';
import { colors, radius, spacing } from '../theme/tokens';
import { Icon } from '../components/ui/Icon';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<AdminStackParamList>();

const TAB_ORDER = ['Dashboard', 'All Jobs', 'Team', 'Reports'] as const;

const ICON_MAP: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  Dashboard: 'grid-outline',
  'All Jobs': 'clipboard-outline',
  Team: 'people-outline',
  Reports: 'bar-chart-outline',
};

const AdminTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);
  const [initialRoute] = useState<string>(() => {
    if (Platform.OS !== 'web') return 'Dashboard';
    try {
      const saved = sessionStorage.getItem('adminTab');
      if (saved && TAB_ORDER.includes(saved as any)) return saved;
    } catch {}
    return 'Dashboard';
  });

  return (
    <Tab.Navigator
      initialRouteName={initialRoute}
      screenListeners={{
        state: (e) => {
          if (Platform.OS !== 'web') return;
          try {
            const { index, routes } = (e.data as any)?.state || {};
            if (routes && typeof index === 'number' && routes[index]) {
              const current = routes[index].name;
              if (current && TAB_ORDER.includes(current as any)) {
                sessionStorage.setItem('adminTab', current);
              }
            }
          } catch {}
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const name = ICON_MAP[route.name];
          return (
            <Icon
              name={name || 'ellipse-outline'}
              size={22}
              color={focused ? colors.accent : colors.textTertiary}
            />
          );
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? bottomPadding - 8 : 0,
          left: spacing.lg,
          right: spacing.lg,
          backgroundColor: colors.headerBg,
          borderTopWidth: 0,
          borderRadius: radius.xl,
          height: 60,
          paddingBottom: 0,
          paddingTop: spacing.sm,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
          marginBottom: spacing.sm,
        },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={withErrorBoundary(AdminDashboardScreen)} />
      <Tab.Screen name="All Jobs" component={withErrorBoundary(AllJobsScreen)} />
      <Tab.Screen name="Team" component={withErrorBoundary(TeamScreen)} />
      <Tab.Screen name="Reports" component={withErrorBoundary(ReportsScreen)} />
    </Tab.Navigator>
  );
};

export const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
    <Stack.Screen name="JobDetailAdminScreen" component={withErrorBoundary(JobDetailAdminScreen)} />
    <Stack.Screen name="Settings" component={withErrorBoundary(SettingsScreen)} />
    <Stack.Screen name="EditProfile" component={withErrorBoundary(EditProfileScreen)} />
    <Stack.Screen name="AddTechnician" component={withErrorBoundary(AddTechnicianScreen)} />
    <Stack.Screen name="CreateJobSheet" component={withErrorBoundary(CreateJobSheetScreen)} />
    <Stack.Screen name="RevenueDashboard" component={withErrorBoundary(RevenueDashboardScreen)} />
    <Stack.Screen name="RevenueTransactions" component={withErrorBoundary(RevenueTransactionsScreen)} />
    <Stack.Screen name="RevenueTransactionForm" component={withErrorBoundary(RevenueTransactionFormScreen)} />
    <Stack.Screen name="RevenueTransactionDetail" component={withErrorBoundary(RevenueTransactionDetailScreen)} />
    <Stack.Screen name="OutstandingCustomers" component={withErrorBoundary(OutstandingCustomersScreen)} />
    <Stack.Screen name="CustomerDetail" component={withErrorBoundary(CustomerDetailScreen)} />
  </Stack.Navigator>
);
