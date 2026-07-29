import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { View, AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';
import { SessionWarningModal } from '../components/SessionWarningModal';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;

type AuthContextType = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updated: Partial<UserProfile>) => void;
  continueSession: () => void;
  warningVisible: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  fetchProfile: async () => {},
  updateProfile: () => {},
  continueSession: () => {},
  warningVisible: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [warningVisible, setWarningVisible] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const warningVisibleRef = useRef(false);
  const signOutRef = useRef<() => Promise<void>>(async () => {});
  const resetActivityRef = useRef<() => void>(() => {});

  warningVisibleRef.current = warningVisible;

  const clearSessionTimer = useCallback(() => {
    setWarningVisible(false);
  }, []);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearSessionTimer();
  }, [clearSessionTimer]);

  const continueSession = useCallback(() => {
    resetActivity();
  }, [resetActivity]);

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

  const signOut = useCallback(async () => {
    clearSessionTimer();
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
    setSession(null);
    setProfile(null);
    try { await AsyncStorage.removeItem('app_navigation_state'); } catch {}
  }, [clearSessionTimer]);

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, full_name, role, phone')
        .eq('id', userId)
        .single();

      if (error || !data) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retry = await supabase
          .from('profiles')
          .select('id, username, email, full_name, role, phone')
          .eq('id', userId)
          .single();
        data = retry.data;
        error = retry.error;
      }

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

  signOutRef.current = signOut;
  resetActivityRef.current = resetActivity;

  // Session timeout check interval
  useEffect(() => {
    if (!session) return;

    lastActivityRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= SESSION_TIMEOUT_MS) {
        signOutRef.current?.();
        return;
      }

      const inWarning = elapsed >= SESSION_TIMEOUT_MS - WARNING_DURATION_MS;
      if (inWarning && !warningVisibleRef.current) {
        setWarningVisible(true);
      } else if (!inWarning && warningVisibleRef.current) {
        setWarningVisible(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // AppState listener (mobile background/foreground)
  useEffect(() => {
    if (!session) return;

    const handleAppState = (nextState: string) => {
      if (nextState === 'active' && Date.now() - lastActivityRef.current >= SESSION_TIMEOUT_MS) {
        signOutRef.current?.();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [session]);

  // Web visibility + keyboard listeners
  useEffect(() => {
    if (!session || Platform.OS !== 'web') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivityRef.current >= SESSION_TIMEOUT_MS) {
        signOutRef.current?.();
      }
    };

    const handleInteraction = () => {
      resetActivityRef.current?.();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{
      session, profile, loading, signOut, fetchProfile, updateProfile,
      continueSession, warningVisible,
    }}>
      <View
        style={{ flex: 1 }}
        onPointerDown={() => resetActivityRef.current?.()}
      >
        {children}
      </View>
      <SessionWarningModal
        visible={warningVisible}
        onContinue={continueSession}
      />
    </AuthContext.Provider>
  );
};
