import { Bird, INaturalistResult, Rarity } from '../types';
import { BirdBiography, buildBiographyFromWikipedia } from '../data/birdBiographies';

const BASE_URL = 'https://api.inaturalist.org/v1';

const observationCountToRarity = (count: number): Rarity => {
  if (count >= 1_000_000) return 'Common';
  if (count >= 100_000) return 'Uncommon';
  if (count >= 10_000) return 'Rare';
  return 'Legendary';
};

const parseResult = (result: Record<string, unknown>): INaturalistResult => {
  const taxon = result.taxon as Record<string, unknown>;
  const defaultPhoto = taxon?.default_photo as Record<string, unknown> | undefined;
  return {
    taxon: {
      id: taxon?.id as number,
      name: taxon?.name as string,
      preferredCommonName: taxon?.preferred_common_name as string | undefined,
      observationsCount: (taxon?.observations_count as number) ?? 0,
      defaultPhoto: defaultPhoto
        ? { mediumUrl: defaultPhoto.medium_url as string }
        : undefined,
      wikipediaSummary: taxon?.wikipedia_summary as string | undefined,
    },
    combinedScore: result.combined_score as number,
  };
};

export const identifyBirdFromUri = async (
  imageUri: string,
): Promise<INaturalistResult[]> => {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'bird.jpg',
  } as unknown as Blob);

  const response = await fetch(`${BASE_URL}/computervision/score_image`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`iNaturalist API error: ${response.status}`);
  }

  const data = await response.json();
  const results: INaturalistResult[] = (data.results as Record<string, unknown>[])
    .filter((r) => {
      const taxon = r.taxon as Record<string, unknown>;
      return taxon?.iconic_taxon_name === 'Aves';
    })
    .slice(0, 5)
    .map(parseResult);

  return results;
};

export const inaturalistResultToBird = (result: INaturalistResult): Bird => ({
  id: `inat-${result.taxon.id}`,
  commonName: result.taxon.preferredCommonName ?? result.taxon.name,
  scientificName: result.taxon.name,
  rarity: observationCountToRarity(result.taxon.observationsCount),
  thumbnailUrl: result.taxon.defaultPhoto?.mediumUrl,
  funFacts: result.taxon.wikipediaSummary
    ? [result.taxon.wikipediaSummary.split('. ').slice(0, 2).join('. ') + '.']
    : undefined,
  observationCount: result.taxon.observationsCount,
});

export const fetchTaxonDetails = async (taxonId: number) => {
  const response = await fetch(`${BASE_URL}/taxa/${taxonId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.results?.[0] ?? null;
};

export const fetchBirdBiography = async (
  taxonId: number,
): Promise<BirdBiography | null> => {
  const taxon = await fetchTaxonDetails(taxonId);
  if (!taxon) return null;

  const summary: string = taxon.wikipedia_summary ?? '';
  if (!summary) return null;

  const conservation = taxon.conservation_status as
    | { status: string; status_name: string }
    | undefined;

  return buildBiographyFromWikipedia(
    summary,
    conservation?.status_name ?? '',
    conservation?.status ?? '',
  );
};

export const RARITY_FUN_FACTS: Record<Rarity, string> = {
  Common: 'This species is frequently observed by birders around the world.',
  Uncommon: 'Spotting this bird takes a keen eye — you\'re doing great!',
  Rare: 'Very few observers have logged this species. Exceptional find!',
  Legendary: 'An extraordinary discovery! This bird is almost never spotted.',
};
