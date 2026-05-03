import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';

type AuthContextType = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updated: Partial<UserProfile>) => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  fetchProfile: async () => {},
  updateProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setSession(null);
        setLoading(false);
      } else if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setSession(null);
      setProfile(null);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      console.log('Fetching profile for userId:', userId);

      // First attempt
      let { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, full_name, role, phone')
        .eq('id', userId)
        .single();

      // Retry logic for mobile/slow connections
      if (error || !data) {
        console.log('Profile fetch attempt 1 failed, retrying in 1s...', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retry = await supabase
          .from('profiles')
          .select('id, username, email, full_name, role, phone')
          .eq('id', userId)
          .single();
        data = retry.data;
        error = retry.error;
      }

      console.log('Profile result:', data);
      console.log('Profile error:', error);

      if (error || !data) {
        setProfile(null);
      } else {
        setProfile(data as UserProfile);
      }
    } catch (error) {
      console.error('Unexpected error in fetchProfile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = (updated: Partial<UserProfile>) => {
    setProfile(prev => prev ? { ...prev, ...updated } as UserProfile : null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, fetchProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
