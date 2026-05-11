import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import Navigation from './src/navigation';
import { supabase } from './src/services/supabase';
import { useStore } from './src/store/useStore';
import CatchAnimation from './src/components/CatchAnimation';

export default function App() {
  const { setSession, loadProfile, loadUserBirds, loadRecentSightings, catchAnimation, setCatchAnimation } = useStore();

  useEffect(() => {
    // Bootstrap auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user.id) {
        const uid = session.user.id;
        loadUserBirds(uid).then(() => loadProfile(uid));
        loadRecentSightings(uid);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user.id) {
        const uid = session.user.id;
        loadUserBirds(uid).then(() => loadProfile(uid));
        loadRecentSightings(uid);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Navigation />
      {catchAnimation && (
        <CatchAnimation
          result={catchAnimation}
          onDismiss={() => setCatchAnimation(null)}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
