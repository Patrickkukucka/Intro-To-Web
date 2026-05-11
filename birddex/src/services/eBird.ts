import Constants from 'expo-constants';
import { Bird, Rarity } from '../types';

const EBIRD_BASE = 'https://api.ebird.org/v2';

const getApiKey = () =>
  process.env.EXPO_PUBLIC_EBIRD_API_KEY ??
  (Constants.expoConfig?.extra?.eBirdApiKey as string) ??
  '';

export interface EBirdSpecies {
  speciesCode: string;
  comName: string;
  sciName: string;
  order: string;
  familyComName: string;
  familySciName: string;
  category: string;
}

// Assign rarity heuristically from taxonomy order — species earlier in the list
// (passerines, waterfowl) tend to be more common. This is a rough approximation;
// real frequency data requires region-specific eBird API calls.
const indexToRarity = (index: number, total: number): Rarity => {
  const pct = index / total;
  if (pct < 0.3) return 'Common';
  if (pct < 0.6) return 'Uncommon';
  if (pct < 0.85) return 'Rare';
  return 'Legendary';
};

export const fetchEBirdTaxonomy = async (): Promise<Bird[]> => {
  const apiKey = getApiKey();
  const response = await fetch(
    `${EBIRD_BASE}/ref/taxonomy/ebird?fmt=json&cat=species`,
    {
      headers: {
        'X-eBirdApiToken': apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`eBird taxonomy fetch failed: ${response.status}`);
  }

  const data: EBirdSpecies[] = await response.json();
  const total = data.length;

  return data.map((species, index): Bird => ({
    id: species.speciesCode,
    commonName: species.comName,
    scientificName: species.sciName,
    family: species.familyComName,
    order: species.order,
    rarity: indexToRarity(index, total),
  }));
};

export const searchEBirdSpecies = async (query: string): Promise<Bird[]> => {
  const apiKey = getApiKey();
  const response = await fetch(
    `${EBIRD_BASE}/ref/taxonomy/ebird?fmt=json&cat=species&q=${encodeURIComponent(query)}`,
    { headers: { 'X-eBirdApiToken': apiKey } },
  );

  if (!response.ok) return [];
  const data: EBirdSpecies[] = await response.json();

  return data.slice(0, 20).map((species, index): Bird => ({
    id: species.speciesCode,
    commonName: species.comName,
    scientificName: species.sciName,
    family: species.familyComName,
    order: species.order,
    rarity: indexToRarity(index, 20),
  }));
};

export const TOTAL_EBIRD_SPECIES = 10_906;
