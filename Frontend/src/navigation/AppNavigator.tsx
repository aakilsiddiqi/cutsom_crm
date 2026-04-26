import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Alert } from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../services/supabase';
import { RootStackParamList, UserRole } from '../types';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { UserDashboardScreen } from '../screens/user/UserDashboardScreen';
import { CreateJobSheetScreen } from '../screens/user/CreateJobSheetScreen';
import { JobSheetDetailScreen } from '../screens/user/JobSheetDetailScreen';
import { EditJobSheetScreen } from '../screens/user/EditJobSheetScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('Authenticated user ID:', userId);
      console.log('Fetching profile...');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, email, full_name, role, phone')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.log('Profile fetch error:', profileError);
        console.log('Looking for user id:', userId);
        throw new Error('Profile not found. Contact your admin. Details: ' + profileError.message);
      }

      setUserRole(profile?.role || 'user');
    } catch (error: any) {
      console.error('Error fetching role:', error);
      Alert.alert('Error', error.message || 'Failed to fetch profile.');
      // If we can't get a profile, we shouldn't let them in as 'user' by default to avoid a broken state
      setUserRole(null);
      // Optional: supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ffcc00" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session ? (
          // Auth Stack
          <Stack.Screen name="Auth" component={LoginScreen} options={{ headerShown: false }} />
        ) : userRole === 'admin' ? (
          // Admin Stack
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
        ) : (
          // User Stack
          <>
            <Stack.Screen name="UserDashboard" component={UserDashboardScreen} options={{ headerShown: false }} />
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

