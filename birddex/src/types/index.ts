export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

export interface Bird {
  id: string; // eBird species code
  commonName: string;
  scientificName: string;
  family?: string;
  order?: string;
  rarity: Rarity;
  thumbnailUrl?: string;
  funFacts?: string[];
  observationCount?: number;
}

export interface Sighting {
  id: string;
  userId: string;
  birdId: string;
  bird?: Bird;
  photoUrl?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  spottedAt: string; // ISO string
  createdAt: string;
}

export interface UserBird {
  userId: string;
  birdId: string;
  bird?: Bird;
  timesSeen: number;
  firstSeenAt: string;
  lastSeenAt: string;
  firstPhotoUrl?: string;
}

export interface Profile {
  id: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  streakCount: number;
  lastActiveDate?: string;
  isPro: boolean;
  countryCode?: string;
  region?: string;
  totalBirds: number;
  rarestBird?: Bird;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  locked: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  totalBirds: number;
  rarestCatch?: Bird;
  isPro: boolean;
  countryCode?: string;
}

export interface INaturalistResult {
  taxon: {
    id: number;
    name: string;
    preferredCommonName?: string;
    observationsCount: number;
    defaultPhoto?: {
      mediumUrl: string;
    };
    wikipediaSummary?: string;
  };
  combinedScore: number;
}

export interface IdentificationResult {
  bird: Bird;
  confidence: number;
  photoUrl?: string;
  isNewSpecies: boolean;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  SightingDetail: { sightingId: string };
  BirdDetail: { birdId: string; userBird?: UserBird };
  ProUpgrade: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Camera: undefined;
  BirdDex: undefined;
  Profile: undefined;
  Leaderboard: undefined;
};

export interface AppState {
  user: Profile | null;
  userBirds: UserBird[];
  recentSightings: Sighting[];
  allBirds: Bird[];
  isLoading: boolean;
  catchAnimation: IdentificationResult | null;
}
