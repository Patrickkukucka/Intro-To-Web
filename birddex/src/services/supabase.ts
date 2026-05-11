import { Platform } from 'react-native';
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string) ??
  '';

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string) ??
  '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helpers
export const signUp = (email: string, password: string, username: string) =>
  supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getCurrentUser = () => supabase.auth.getUser();

// Profile helpers
export const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`*, user_birds(count)`)
    .eq('id', userId)
    .single();
  return { data, error };
};

export const upsertProfile = async (profile: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single();
  return { data, error };
};

// Sightings helpers
export const fetchRecentSightings = async (userId: string, limit = 20) => {
  const { data, error } = await supabase
    .from('sightings')
    .select(`*, birds(*)`)
    .eq('user_id', userId)
    .order('spotted_at', { ascending: false })
    .limit(limit);
  return { data, error };
};

export const insertSighting = async (sighting: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from('sightings')
    .insert(sighting)
    .select()
    .single();
  return { data, error };
};

// User birds (collection)
export const fetchUserBirds = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_birds')
    .select(`*, birds(*)`)
    .eq('user_id', userId)
    .order('first_seen_at', { ascending: false });
  return { data, error };
};

export const upsertUserBird = async (
  userId: string,
  birdId: string,
  photoUrl?: string,
) => {
  const { data: existing } = await supabase
    .from('user_birds')
    .select('*')
    .eq('user_id', userId)
    .eq('bird_id', birdId)
    .single();

  if (existing) {
    return supabase
      .from('user_birds')
      .update({ times_seen: existing.times_seen + 1, last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('bird_id', birdId)
      .select()
      .single();
  }

  return supabase
    .from('user_birds')
    .insert({
      user_id: userId,
      bird_id: birdId,
      first_photo_url: photoUrl,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      times_seen: 1,
    })
    .select()
    .single();
};

// Leaderboard
export const fetchLeaderboard = async (
  countryCode?: string,
  limit = 100,
) => {
  let query = supabase
    .from('leaderboard')
    .select('*')
    .order('total_birds', { ascending: false })
    .limit(limit);

  if (countryCode) {
    query = query.eq('country_code', countryCode);
  }

  return query;
};

// Photo storage
export const uploadBirdPhoto = async (userId: string, uri: string, birdId: string) => {
  const fileName = `${userId}/${birdId}/${Date.now()}.jpg`;
  const response = await fetch(uri);
  const blob = await response.blob();

  const { data, error } = await supabase.storage
    .from('bird-photos')
    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) return { url: null, error };

  const { data: urlData } = supabase.storage
    .from('bird-photos')
    .getPublicUrl(data.path);

  return { url: urlData.publicUrl, error: null };
};
