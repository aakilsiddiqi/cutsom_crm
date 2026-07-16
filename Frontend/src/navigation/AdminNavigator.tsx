import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

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
import { AdminStackParamList } from '../types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<AdminStackParamList>();

// Inner tab navigator
const AdminTabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#1a1a2e',
        borderTopColor: '#FFD700',
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: '#FFD700',
      tabBarInactiveTintColor: '#888888',
      tabBarLabelStyle: {
        fontSize: 12,
        paddingBottom: 4,
      },
    }}
  >
    <Tab.Screen name="Dashboard" component={withErrorBoundary(AdminDashboardScreen)} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text> }} />
    <Tab.Screen name="All Jobs" component={withErrorBoundary(AllJobsScreen)} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📋</Text> }} />
    <Tab.Screen name="Team" component={withErrorBoundary(TeamScreen)} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>👥</Text> }} />
    <Tab.Screen name="Reports" component={withErrorBoundary(ReportsScreen)} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📈</Text> }} />
  </Tab.Navigator>
);

// Outer stack so detail screens can be pushed over tabs
export const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
    <Stack.Screen name="JobDetailAdminScreen" component={withErrorBoundary(JobDetailAdminScreen)} />
    <Stack.Screen name="Settings" component={withErrorBoundary(SettingsScreen)} />
    <Stack.Screen name="EditProfile" component={withErrorBoundary(EditProfileScreen)} />
    <Stack.Screen name="AddTechnician" component={withErrorBoundary(AddTechnicianScreen)} />
    <Stack.Screen name="CreateJobSheet" component={withErrorBoundary(CreateJobSheetScreen)} />
  </Stack.Navigator>
);
