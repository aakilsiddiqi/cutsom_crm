import React, { useEffect, useState } from 'react';
import { NavigationContainer, LinkingOptions, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

import { withErrorBoundary } from '../components/ErrorBoundary';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminNavigator } from './AdminNavigator';
import { UserDashboardScreen } from '../screens/user/UserDashboardScreen';
import { CreateJobSheetScreen } from '../screens/user/CreateJobSheetScreen';
import { JobSheetDetailScreen } from '../screens/user/JobSheetDetailScreen';
import { EditJobSheetScreen } from '../screens/user/EditJobSheetScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAV_STATE_KEY = 'app_navigation_state';

export const AppNavigator = () => {
  const { session, profile, loading } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [initialState, setInitialState] = useState<any>(undefined);

  useEffect(() => {
    try {
      const restore = async () => {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);
        if (saved) setInitialState(JSON.parse(saved));
      };
      restore();
    } catch {}
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#ffcc00" />
      </View>
    );
  }

  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ['https://jcb-workshop-crm.vercel.app', 'jcbcrm://'],
    config: {
      screens: {
        Auth: 'login',
        AdminNavigator: {
          screens: {
            AdminTabs: {
              screens: {
                Dashboard: 'admin/dashboard',
                AllJobs: 'admin/jobs',
                Team: 'admin/team',
                Reports: 'admin/reports'
              }
            },
            JobDetailAdminScreen: 'admin/job/:jobSheetId',
            Settings: 'admin/settings',
            EditProfile: 'admin/profile/edit',
            AddTechnician: 'admin/technician/add',
            CreateJobSheet: 'admin/job/create',
            RevenueDashboard: 'admin/revenue',
            RevenueTransactions: 'admin/revenue/transactions',
            RevenueTransactionForm: 'admin/revenue/transaction/form',
            RevenueTransactionDetail: 'admin/revenue/transaction/:transactionId',
            OutstandingCustomers: 'admin/revenue/outstanding',
            CustomerDetail: 'admin/revenue/customer/:customerId'
          }
        },
        UserDashboard: 'user/dashboard',
        Settings: 'user/settings',
        EditProfile: 'user/profile/edit',
        CreateJobSheet: 'user/job/create',
        JobSheetDetail: 'user/job/:jobSheetId',
        EditJobSheet: 'user/job/edit/:jobSheetId'
      }
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      initialState={initialState}
      onStateChange={(state) => {
        try {
          if (state) AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
        } catch {}
      }}
    >
      <Stack.Navigator>
        {!session || !profile ? (
          <Stack.Screen name="Auth" component={withErrorBoundary(LoginScreen)} options={{ headerShown: false }} />
        ) : profile.role === 'admin' ? (
          <Stack.Screen name="AdminNavigator" component={AdminNavigator} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="UserDashboard" component={withErrorBoundary(UserDashboardScreen)} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={withErrorBoundary(SettingsScreen)} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={withErrorBoundary(EditProfileScreen)} options={{ headerShown: false }} />
            <Stack.Screen name="CreateJobSheet" component={withErrorBoundary(CreateJobSheetScreen)} options={{ headerTitle: 'New Job Sheet', headerStyle: { backgroundColor: '#ffcc00' }, headerTintColor: '#000', headerBackTitle: '' }} />
            <Stack.Screen name="JobSheetDetail" component={withErrorBoundary(JobSheetDetailScreen)} options={{ headerTitle: 'Job Details', headerStyle: { backgroundColor: '#ffcc00' }, headerTintColor: '#000', headerBackTitle: '' }} />
            <Stack.Screen name="EditJobSheet" component={withErrorBoundary(EditJobSheetScreen)} options={{ headerTitle: 'Edit Job', headerStyle: { backgroundColor: '#ffcc00' }, headerTintColor: '#000', headerBackTitle: '' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

