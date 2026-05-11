export interface BirdBiography {
  summary: string;
  habitat: string;
  diet: string;
  behavior: string;
  funFact: string;
  conservationStatus: string;
  conservationCode: ConservationCode;
}

export type ConservationCode = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX' | 'DD' | 'NE';

export const CONSERVATION_COLORS: Record<ConservationCode, string> = {
  LC: '#52B788',
  NT: '#95D5B2',
  VU: '#FFD166',
  EN: '#F4845F',
  CR: '#E05C5C',
  EW: '#9B5DE5',
  EX: '#666666',
  DD: '#7B9CB5',
  NE: '#4A6A80',
};

export const CONSERVATION_LABELS: Record<ConservationCode, string> = {
  LC: 'Least Concern',
  NT: 'Near Threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically Endangered',
  EW: 'Extinct in Wild',
  EX: 'Extinct',
  DD: 'Data Deficient',
  NE: 'Not Evaluated',
};

// Pre-written biographies for the 10 seed birds in schema.sql.
// Keys match the eBird species codes used as bird IDs.
export const SEED_BIRD_BIOGRAPHIES: Record<string, BirdBiography> = {
  amecro: {
    summary:
      'The American Crow is one of the most intelligent birds in the world, found across most of North America. Known for its glossy black plumage and loud "caw" call, it thrives in a remarkable range of habitats from deep forest to city parks.',
    habitat:
      'Highly adaptable — occupies forests, farmland, river groves, suburbs, and urban parks. Roosts communally in winter, sometimes in flocks of thousands.',
    diet:
      'Omnivore par excellence. Eats carrion, insects, earthworms, berries, seeds, small mammals, eggs, and human food scraps. Uses traffic to crack hard-shelled food.',
    behavior:
      'Lives in family groups where offspring from previous years help raise new chicks. Mobs owls and hawks to drive them away. Known to cache food and remember hiding spots.',
    funFact:
      'Research has shown that American Crows can recognize and remember individual human faces, and will warn other crows about specific people they perceive as threats — for years.',
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  mallar3: {
    summary:
      'The Mallard is the most familiar duck in the Northern Hemisphere and the ancestor of nearly all domestic duck breeds. Males sport their iconic iridescent green head during breeding season, while females wear streaky brown camouflage plumage year-round.',
    habitat:
      'Found on virtually any body of freshwater — ponds, lakes, rivers, marshes, city parks, and flooded fields. Migratory populations winter on coastal estuaries and southern wetlands.',
    diet:
      'Dabbling omnivore. Tips upside-down in shallow water to reach aquatic plants, seeds, invertebrates, and small fish. Also grazes on grasses and grain in fields.',
    behavior:
      'Forms pair bonds in autumn and winter, with males performing elaborate head-pumping and wing-flapping courtship displays. Females lead ducklings to water within 24 hours of hatching.',
    funFact:
      "Only the female gives the classic loud \"quack.\" The male produces a quiet, raspy sound. The female's call is used in virtually every cartoon, movie, and sound library representing \"a duck.\"",
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  norcar: {
    summary:
      'The Northern Cardinal is among the most recognizable birds in North America, with brilliant scarlet males that are unmistakable at backyard feeders. Originally a bird of the southeast, it has expanded its range dramatically northward over the past century.',
    habitat:
      'Edges of woodland, thickets, hedgerows, suburban gardens, and parks. Favors dense shrubs for nesting and foraging. Does not migrate and holds territories year-round.',
    diet:
      'Primarily seeds (especially sunflower seeds and safflower), supplemented with berries, insects, and fruit. Young are fed almost entirely on insects for their first weeks of life.',
    behavior:
      'One of the few North American songbirds where females sing, often from the nest. Males aggressively defend territory and are famous for attacking their own reflection in windows and mirrors.',
    funFact:
      'The red pigmentation in male cardinals comes entirely from carotenoids in their diet. Males with access to more berries and insects are redder, and redder males attract higher-quality mates.',
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  amegfi: {
    summary:
      'The American Goldfinch is a small, bright-yellow songbird beloved at backyard feeders across North America. Males undergo a dramatic molt twice a year — brilliant canary yellow in summer, olive-drab in winter — while females remain soft yellow year-round.',
    habitat:
      'Open country, weedy fields, floodplain forests, orchards, and suburban gardens. Closely tied to areas with thistles and other composites whose seeds are a primary food source.',
    diet:
      'Almost exclusively seeds, especially from thistles, sunflowers, and dandelions. One of the most strictly vegetarian of all North American birds; even nestlings are fed seed mash rather than insects.',
    behavior:
      'Nests unusually late in summer (July–August) to synchronize with peak thistle seed availability. Builds a cup so tightly woven it can briefly hold water. Travels in undulating, roller-coaster flight.',
    funFact:
      "Brown-headed Cowbirds sometimes lay eggs in Goldfinch nests, but the nestlings rarely survive — the all-seed diet provided by the parents isn't rich enough in protein for cowbird chicks.",
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  blujay: {
    summary:
      'The Blue Jay is a strikingly beautiful, highly vocal bird of eastern North America, instantly recognizable by its blue, white, and black plumage and prominent crest. Bold and intelligent, it is equally at home in dense forest and busy city neighborhoods.',
    habitat:
      'Deciduous and mixed forests, forest edges, suburbs, and parks with mature oak trees. Resident year-round in most of its range; northern populations migrate south in loose flocks.',
    diet:
      'Omnivore. Eats acorns (a crucial food and caching item), seeds, nuts, insects, eggs, and occasionally small vertebrates. A single jay can carry up to 5 acorns at once in its bill and throat pouch.',
    behavior:
      'A master mimic — perfectly imitates Red-shouldered and Red-tailed Hawk calls, often causing other birds to flee feeders. A single family of Blue Jays can cache and later retrieve tens of thousands of acorns in a season.',
    funFact:
      "Blue Jays are critical to forest regeneration. By burying acorns and forgetting many of them, jays have been largely responsible for the northward spread of oak forests after the last Ice Age.",
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  dowwoo: {
    summary:
      'The Downy Woodpecker is the smallest woodpecker in North America and the most common visitor to backyard suet feeders. Despite its diminutive size, it is a powerful excavator, capable of drilling into wood to find hidden insects.',
    habitat:
      'Found in almost every wooded habitat — deciduous and mixed forests, orchards, willow thickets, city parks, and suburban backyards. Particularly common along streams and in edge habitats.',
    diet:
      'Insects and larvae extracted from wood form the core diet, supplemented with berries, seeds, and suet from feeders. Its short bill specializes in feeding on weed stems and small branches, a niche not used by larger woodpeckers.',
    behavior:
      'Excavates a new nest cavity each breeding season, creating vital nesting sites used by chickadees, nuthatches, and flying squirrels in subsequent years. Drums on resonant wood to communicate and attract mates.',
    funFact:
      "A woodpecker's brain is protected from the shock of hammering by a hyoid bone that wraps almost entirely around the skull, acting like a seatbelt. The Downy pecks up to 20 times per second.",
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  baleag: {
    summary:
      "The Bald Eagle is the national bird and symbol of the United States, and one of conservation's greatest success stories. Reduced to fewer than 500 nesting pairs in the lower 48 states by the 1960s due to DDT poisoning, it has rebounded to over 9,000 pairs following the chemical's ban.",
    habitat:
      'Always near large bodies of open water — lakes, rivers, reservoirs, and coastlines — where fish are plentiful. Builds the largest nest of any North American bird, sometimes over 2 metres wide and weighing over a tonne.',
    diet:
      'Fish are the dietary staple, caught with a dramatic talon-first plunge or stolen from Ospreys mid-flight. Also takes waterfowl, mammals, and carrion, especially road-killed deer in winter.',
    behavior:
      'Mates for life and returns to the same nest site year after year, adding sticks each season. Juveniles spend 4–5 years in mottled brown plumage before developing the signature white head and tail.',
    funFact:
      "An eagle's eyesight is four to eight times more acute than a human's. A Bald Eagle can spot a fish from 1.5 km away, and its eyes are nearly the same size as a human's despite the bird being far smaller.",
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  pilgri: {
    summary:
      'The Peregrine Falcon is the fastest animal on Earth, reaching speeds exceeding 320 km/h (200 mph) in a hunting stoop. Found on every continent except Antarctica, it is the world\'s most widespread raptor and a remarkable story of urban adaptation.',
    habitat:
      'Naturally nests on coastal cliffs, mountain ledges, and river gorges. Has successfully colonized cities worldwide, where tall buildings substitute for cliffs and pigeons provide abundant prey.',
    diet:
      'Almost exclusively medium-sized birds caught in the air — pigeons, shorebirds, ducks, and songbirds. Strikes prey with clenched talons at full speed, killing instantly.',
    behavior:
      'Hunts with a vertical power dive called a "stoop," folding its wings and plunging from height. The notch in its beak, called a tomial tooth, is used to sever the spinal cord of captured prey.',
    funFact:
      'Peregrine Falcons navigated by detecting polarized light from the sun even on cloudy days. They also have a third eyelid (nictitating membrane) that protects their eyes and maintains vision during a 320 km/h dive.',
    conservationStatus: 'Least Concern',
    conservationCode: 'LC',
  },
  whocrn: {
    summary:
      'The Whooping Crane is the tallest bird in North America and one of the world\'s most endangered, with the entire wild population reduced to just 21 birds in 1941. Decades of intensive conservation have brought numbers to over 800 birds today, making it a symbol of what dedicated effort can achieve.',
    habitat:
      'Breeds in remote boreal wetlands of Wood Buffalo National Park, Canada. Winters on the Gulf Coast of Texas at Aransas National Wildlife Refuge, migrating 4,000 km between the two.',
    diet:
      'Omnivore on the wintering grounds — blue crabs, clams, acorns, and berries. Eats frogs, insects, small rodents, and marsh plants on the breeding grounds.',
    behavior:
      'Famous for elaborate dancing displays used in courtship and social bonding — birds leap, bow, toss sticks and grass, and call loudly. Pairs mate for life and defend large territories.',
    funFact:
      "Ultralight aircraft were used to teach a captive-reared flock their migration route, with costumed pilots leading the cranes from Wisconsin to Florida. This 'Operation Migration' program ran for 16 years.",
    conservationStatus: 'Endangered',
    conservationCode: 'EN',
  },
  calcon: {
    summary:
      "The California Condor is the largest land bird in North America with a wingspan of up to 3 metres (9.8 ft), and one of the world's longest-lived birds, potentially reaching 60 years of age. It was declared extinct in the wild in 1987 when the last 27 birds were captured for a last-ditch breeding program.",
    habitat:
      'Rocky, forested mountain ranges, gorges, and open country across California, Utah, Arizona, Baja California, and Baja California Sur. Requires vast open areas to locate carcasses and thermal updrafts for effortless soaring.',
    diet:
      'Obligate scavenger — feeds entirely on large animal carcasses including deer, cattle, beached whales, and sea lions. Can soar up to 240 km per day in search of food, then gorge on up to 1.5 kg in one sitting.',
    behavior:
      'Highly social and intelligent, with complex dominance hierarchies. Roosts communally, engages in social preening, and cares for a single chick for over a year — one of the longest parental care periods of any bird.',
    funFact:
      "Lead poisoning from ingesting bullet fragments in carcasses remains the primary threat to California Condors. Each bird has a numbered wing tag and is monitored individually; many require annual blood tests and occasional chelation therapy.",
    conservationStatus: 'Critically Endangered',
    conservationCode: 'CR',
  },
};

/** Build a partial biography from iNaturalist's Wikipedia summary text. */
export function buildBiographyFromWikipedia(
  summary: string,
  statusName: string,
  statusCode: string,
): BirdBiography {
  // Take the first 3 complete sentences for the summary block
  const sentences = summary
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 10);

  const shortSummary = sentences.slice(0, 3).join(' ');

  // Extract habitat hint: sentence containing "habitat", "found in", "lives in", "occurs in"
  const habitatSentence =
    sentences.find((s) =>
      /habitat|found in|lives in|occurs in|range extends|distributed/i.test(s),
    ) ?? sentences[1] ?? '';

  // Extract diet hint
  const dietSentence =
    sentences.find((s) =>
      /feed|diet|eat|prey|forage|carnivore|omnivore|herbivore|insectivore/i.test(s),
    ) ?? '';

  // Extract behavior hint
  const behaviorSentence =
    sentences.find((s) =>
      /nest|breed|flock|migrat|behavior|display|court|social|roost/i.test(s),
    ) ?? '';

  const code = statusCode?.toUpperCase() as ConservationCode;
  const validCode: ConservationCode = CONSERVATION_LABELS[code] ? code : 'NE';

  return {
    summary: shortSummary || summary.slice(0, 300),
    habitat: habitatSentence || 'Habitat details not available.',
    diet: dietSentence || 'Diet details not available.',
    behavior: behaviorSentence || 'Behavioral details not available.',
    funFact: sentences[sentences.length - 1] ?? '',
    conservationStatus: statusName || CONSERVATION_LABELS[validCode],
    conservationCode: validCode,
  };
}
