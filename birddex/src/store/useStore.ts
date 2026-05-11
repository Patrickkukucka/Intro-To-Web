import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import {
  Bird,
  Badge,
  IdentificationResult,
  LeaderboardEntry,
  Profile,
  Sighting,
  UserBird,
} from '../types';
import {
  fetchProfile,
  fetchRecentSightings,
  fetchUserBirds,
  fetchLeaderboard,
  upsertUserBird,
  insertSighting,
  uploadBirdPhoto,
  upsertProfile,
} from '../services/supabase';
import { TOTAL_EBIRD_SPECIES } from '../services/eBird';
import { rarityOrder } from '../theme';

const FREE_TIER_LIMIT = 20;

interface StoreState {
  session: Session | null;
  profile: Profile | null;
  userBirds: UserBird[];
  recentSightings: Sighting[];
  leaderboard: LeaderboardEntry[];
  catchAnimation: IdentificationResult | null;
  isLoadingProfile: boolean;
  isLoadingBirds: boolean;
  isLoadingLeaderboard: boolean;
  totalSpecies: number;

  setSession: (session: Session | null) => void;
  loadProfile: (userId: string) => Promise<void>;
  loadUserBirds: (userId: string) => Promise<void>;
  loadRecentSightings: (userId: string) => Promise<void>;
  loadLeaderboard: (countryCode?: string) => Promise<void>;
  logSighting: (params: LogSightingParams) => Promise<{ isNew: boolean; limitReached: boolean }>;
  setCatchAnimation: (result: IdentificationResult | null) => void;
  updateStreak: (userId: string) => Promise<void>;
  reset: () => void;
}

interface LogSightingParams {
  userId: string;
  bird: Bird;
  photoUri?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  notes?: string;
}

const computeBadges = (userBirds: UserBird[], profile: Profile): Badge[] => {
  const count = userBirds.length;
  const hasRare = userBirds.some(
    (ub) => ub.bird && (ub.bird.rarity === 'Rare' || ub.bird.rarity === 'Legendary'),
  );
  const hasLegendary = userBirds.some((ub) => ub.bird?.rarity === 'Legendary');

  const badges: Badge[] = [
    {
      id: 'first_bird',
      name: 'First Bird',
      description: 'Log your first sighting',
      icon: '🐦',
      locked: count < 1,
      unlockedAt: count >= 1 ? userBirds[userBirds.length - 1]?.firstSeenAt : undefined,
    },
    {
      id: 'ten_species',
      name: 'Fledgling',
      description: 'Discover 10 species',
      icon: '🪺',
      locked: count < 10,
    },
    {
      id: 'fifty_species',
      name: 'Birder',
      description: 'Discover 50 species',
      icon: '🔭',
      locked: count < 50,
    },
    {
      id: 'hundred_species',
      name: 'Ornithologist',
      description: 'Discover 100 species',
      icon: '🎓',
      locked: count < 100,
    },
    {
      id: 'rare_finder',
      name: 'Rare Finder',
      description: 'Spot a Rare species',
      icon: '💜',
      locked: !hasRare,
    },
    {
      id: 'legendary_spotter',
      name: 'Legendary Spotter',
      description: 'Spot a Legendary species',
      icon: '🌟',
      locked: !hasLegendary,
    },
    {
      id: 'week_streak',
      name: 'Daily Birder',
      description: '7-day activity streak',
      icon: '🔥',
      locked: profile.streakCount < 7,
    },
    {
      id: 'month_streak',
      name: 'Dedicated',
      description: '30-day activity streak',
      icon: '🏆',
      locked: profile.streakCount < 30,
    },
  ];

  return badges;
};

const findRarestBird = (userBirds: UserBird[]): Bird | undefined => {
  return userBirds
    .filter((ub) => ub.bird)
    .sort(
      (a, b) =>
        rarityOrder[b.bird!.rarity] - rarityOrder[a.bird!.rarity],
    )[0]?.bird;
};

export const useStore = create<StoreState>((set, get) => ({
  session: null,
  profile: null,
  userBirds: [],
  recentSightings: [],
  leaderboard: [],
  catchAnimation: null,
  isLoadingProfile: false,
  isLoadingBirds: false,
  isLoadingLeaderboard: false,
  totalSpecies: TOTAL_EBIRD_SPECIES,

  setSession: (session) => set({ session }),

  loadProfile: async (userId) => {
    set({ isLoadingProfile: true });
    const { data } = await fetchProfile(userId);
    if (data) {
      const userBirds = get().userBirds;
      const badges = computeBadges(userBirds, data as Profile);
      const rarestBird = findRarestBird(userBirds);
      set({
        profile: {
          ...data,
          totalBirds: userBirds.length,
          badges,
          rarestBird,
        } as Profile,
      });
    }
    set({ isLoadingProfile: false });
  },

  loadUserBirds: async (userId) => {
    set({ isLoadingBirds: true });
    const { data } = await fetchUserBirds(userId);
    if (data) {
      const userBirds: UserBird[] = data.map((row: Record<string, unknown>) => ({
        userId: row.user_id as string,
        birdId: row.bird_id as string,
        bird: row.birds as Bird | undefined,
        timesSeen: row.times_seen as number,
        firstSeenAt: row.first_seen_at as string,
        lastSeenAt: row.last_seen_at as string,
        firstPhotoUrl: row.first_photo_url as string | undefined,
      }));
      set({ userBirds });
    }
    set({ isLoadingBirds: false });
  },

  loadRecentSightings: async (userId) => {
    const { data } = await fetchRecentSightings(userId);
    if (data) {
      const sightings: Sighting[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        userId: row.user_id as string,
        birdId: row.bird_id as string,
        bird: row.birds as Bird | undefined,
        photoUrl: row.photo_url as string | undefined,
        notes: row.notes as string | undefined,
        latitude: row.latitude as number | undefined,
        longitude: row.longitude as number | undefined,
        locationName: row.location_name as string | undefined,
        spottedAt: row.spotted_at as string,
        createdAt: row.created_at as string,
      }));
      set({ recentSightings: sightings });
    }
  },

  loadLeaderboard: async (countryCode) => {
    set({ isLoadingLeaderboard: true });
    const { data } = await fetchLeaderboard(countryCode);
    if (data) {
      const entries: LeaderboardEntry[] = data.map(
        (row: Record<string, unknown>, index: number) => ({
          rank: index + 1,
          userId: row.id as string,
          username: row.username as string,
          avatarUrl: row.avatar_url as string | undefined,
          totalBirds: row.total_birds as number,
          isPro: row.is_pro as boolean,
          countryCode: row.country_code as string | undefined,
        }),
      );
      set({ leaderboard: entries });
    }
    set({ isLoadingLeaderboard: false });
  },

  logSighting: async ({ userId, bird, photoUri, latitude, longitude, locationName, notes }) => {
    const { userBirds } = get();
    const isNewSpecies = !userBirds.some((ub) => ub.birdId === bird.id);

    if (!get().profile?.isPro && userBirds.length >= FREE_TIER_LIMIT && isNewSpecies) {
      return { isNew: false, limitReached: true };
    }

    let photoUrl: string | undefined;
    if (photoUri) {
      const { url } = await uploadBirdPhoto(userId, photoUri, bird.id);
      photoUrl = url ?? undefined;
    }

    await insertSighting({
      user_id: userId,
      bird_id: bird.id,
      photo_url: photoUrl,
      notes,
      latitude,
      longitude,
      location_name: locationName,
      spotted_at: new Date().toISOString(),
    });

    await upsertUserBird(userId, bird.id, photoUrl);

    // Refresh local state
    await get().loadUserBirds(userId);
    await get().loadRecentSightings(userId);

    if (isNewSpecies) {
      set({
        catchAnimation: {
          bird,
          confidence: 1,
          photoUrl,
          isNewSpecies: true,
        },
      });
    }

    return { isNew: isNewSpecies, limitReached: false };
  },

  setCatchAnimation: (result) => set({ catchAnimation: result }),

  updateStreak: async (userId) => {
    const today = new Date().toISOString().split('T')[0];
    const profile = get().profile;
    if (!profile) return;

    const lastActive = profile.lastActiveDate;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const newStreak =
      lastActive === today
        ? profile.streakCount
        : lastActive === yesterday
        ? profile.streakCount + 1
        : 1;

    await upsertProfile({
      id: userId,
      streak_count: newStreak,
      last_active_date: today,
    });

    set({ profile: { ...profile, streakCount: newStreak, lastActiveDate: today } });
  },

  reset: () =>
    set({
      session: null,
      profile: null,
      userBirds: [],
      recentSightings: [],
      leaderboard: [],
      catchAnimation: null,
    }),
}));
