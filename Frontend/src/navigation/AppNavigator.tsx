import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../services/supabase';
import { RootStackParamList, UserRole } from '../types';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { UserDashboardScreen } from '../screens/user/UserDashboardScreen';

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
      // For now, let's hardcode a simple way or fetch from a 'users' table
      // In a real app, you would query your users/profiles table:
      // const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
      // setUserRole(data?.role || 'user');
      
      // Placeholder logic: Since we don't have a backend schema yet, we'll just set it to 'user'
      // or we can determine based on email if we wanted.
      setUserRole('admin'); // For demo purposes, we can toggle this or let the backend dictate it
    } catch (error) {
      console.error('Error fetching role:', error);
      setUserRole('user');
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Auth Stack
          <Stack.Screen name="Auth" component={LoginScreen} />
        ) : userRole === 'admin' ? (
          // Admin Stack
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        ) : (
          // User Stack
          <Stack.Screen name="UserDashboard" component={UserDashboardScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
