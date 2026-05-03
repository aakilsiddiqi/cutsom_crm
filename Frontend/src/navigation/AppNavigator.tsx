import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminNavigator } from './AdminNavigator';
import { UserDashboardScreen } from '../screens/user/UserDashboardScreen';
import { CreateJobSheetScreen } from '../screens/user/CreateJobSheetScreen';
import { JobSheetDetailScreen } from '../screens/user/JobSheetDetailScreen';
import { EditJobSheetScreen } from '../screens/user/EditJobSheetScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#ffcc00" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session || !profile ? (
          // Auth Stack
          <Stack.Screen name="Auth" component={LoginScreen} options={{ headerShown: false }} />
        ) : profile.role === 'admin' ? (
          // Admin Stack
          <Stack.Screen name="AdminNavigator" component={AdminNavigator} options={{ headerShown: false }} />
        ) : (
          // User Stack
          <>
            <Stack.Screen name="UserDashboard" component={UserDashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="EditProfile" 
              component={EditProfileScreen} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="CreateJobSheet" 
              component={CreateJobSheetScreen} 
              options={{ 
                headerTitle: 'New Job Sheet',
                headerStyle: { backgroundColor: '#ffcc00' },
                headerTintColor: '#000',
                headerBackTitle: ''
              }} 
            />
            <Stack.Screen 
              name="JobSheetDetail" 
              component={JobSheetDetailScreen} 
              options={{ 
                headerTitle: 'Job Details',
                headerStyle: { backgroundColor: '#ffcc00' },
                headerTintColor: '#000',
                headerBackTitle: ''
              }} 
            />
            <Stack.Screen 
              name="EditJobSheet" 
              component={EditJobSheetScreen} 
              options={{ 
                headerTitle: 'Edit Job',
                headerStyle: { backgroundColor: '#ffcc00' },
                headerTintColor: '#000',
                headerBackTitle: ''
              }} 
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

