import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, radius, typography, rarityColors, shadows } from '../theme';
import { useStore } from '../store/useStore';
import { UserBird, Rarity, RootStackParamList } from '../types';
import RarityBadge from '../components/RarityBadge';
import { TOTAL_EBIRD_SPECIES } from '../services/eBird';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COLUMN_COUNT = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

type Filter = 'All' | 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

function BirdGridCard({ userBird }: { userBird: UserBird }) {
  const navigation = useNavigation<Nav>();
  const rarity = userBird.bird?.rarity ?? 'Common';
  const rarityColor = rarityColors[rarity];

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: rarityColor + '44' }]}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('BirdDetail', { birdId: userBird.birdId, userBird })}
    >
      {userBird.firstPhotoUrl ? (
        <Image source={{ uri: userBird.firstPhotoUrl }} style={styles.cardImage} />
      ) : userBird.bird?.thumbnailUrl ? (
        <Image source={{ uri: userBird.bird.thumbnailUrl }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.placeholderEmoji}>🐦</Text>
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.cardGradient}
      />
      <View style={styles.cardInfo}>
        <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
        <Text style={styles.cardName} numberOfLines={2}>
          {userBird.bird?.commonName ?? 'Unknown'}
        </Text>
        {userBird.timesSeen > 1 && (
          <Text style={styles.cardSeen}>×{userBird.timesSeen}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ProgressBar({ caught, total }: { caught: number; total: number }) {
  const pct = Math.min((caught / total) * 100, 100);
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>
          <Text style={styles.progressCaught}>{caught}</Text>
          <Text style={styles.progressSeparator}> / {total.toLocaleString()}</Text>
          <Text style={styles.progressLabel}> birds discovered</Text>
        </Text>
        <Text style={styles.progressPct}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>
    </View>
  );
}

const FILTERS: Filter[] = ['All', 'Common', 'Uncommon', 'Rare', 'Legendary'];
const RARITY_COLORS: Record<Filter, string> = {
  All: colors.textSecondary,
  Common: colors.common,
  Uncommon: colors.uncommon,
  Rare: colors.rare,
  Legendary: colors.legendary,
};

export default function BirdDexScreen() {
  const { userBirds, totalSpecies } = useStore();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'rarity'>('date');

  const filtered = useMemo(() => {
    let list = [...userBirds];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (ub) =>
          ub.bird?.commonName.toLowerCase().includes(q) ||
          ub.bird?.scientificName.toLowerCase().includes(q),
      );
    }

    if (activeFilter !== 'All') {
      list = list.filter((ub) => ub.bird?.rarity === activeFilter);
    }

    list.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.bird?.commonName ?? '').localeCompare(b.bird?.commonName ?? '');
      }
      if (sortBy === 'rarity') {
        const order: Record<Rarity, number> = { Legendary: 4, Rare: 3, Uncommon: 2, Common: 1 };
        return (order[b.bird?.rarity ?? 'Common'] ?? 0) - (order[a.bird?.rarity ?? 'Common'] ?? 0);
      }
      return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
    });

    return list;
  }, [userBirds, search, activeFilter, sortBy]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BirdDex</Text>
        <TouchableOpacity onPress={() => setSortBy(sortBy === 'date' ? 'name' : sortBy === 'name' ? 'rarity' : 'date')}>
          <View style={styles.sortBtn}>
            <Ionicons name="swap-vertical-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sortBtnText}>{sortBy}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ProgressBar caught={userBirds.length} total={TOTAL_EBIRD_SPECIES} />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search species..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              activeFilter === f && { backgroundColor: RARITY_COLORS[f] + '33', borderColor: RARITY_COLORS[f] },
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: activeFilter === f ? RARITY_COLORS[f] : colors.textMuted },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>
            {userBirds.length === 0 ? 'Your BirdDex is empty' : 'No matches found'}
          </Text>
          <Text style={styles.emptyText}>
            {userBirds.length === 0
              ? 'Identify your first bird to start your collection!'
              : 'Try a different search or filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.birdId}
          numColumns={COLUMN_COUNT}
          renderItem={({ item }) => <BirdGridCard userBird={item} />}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnText: { ...typography.captionBold, color: colors.textSecondary, textTransform: 'capitalize' },

  progressContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  progressTitle: { ...typography.body, color: colors.textSecondary },
  progressCaught: { ...typography.h3, color: colors.primaryLight, fontSize: 20 },
  progressSeparator: { ...typography.body, color: colors.textSecondary },
  progressLabel: { ...typography.caption, color: colors.textMuted },
  progressPct: { ...typography.captionBold, color: colors.primaryLight },
  progressTrack: { height: 8, backgroundColor: colors.surface, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },

  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, height: 40, color: colors.text, ...typography.body },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipText: { ...typography.captionBold },

  grid: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },

  card: {
    width: CARD_SIZE,
    height: CARD_SIZE * 1.2,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    ...shadows.sm,
  },
  cardImage: { width: '100%', height: '100%', position: 'absolute' },
  cardImagePlaceholder: { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 32 },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  cardInfo: { position: 'absolute', bottom: 6, left: 6, right: 6 },
  rarityDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  cardName: { ...typography.tiny, color: colors.text, lineHeight: 13 },
  cardSeen: { ...typography.tiny, color: colors.textSecondary, marginTop: 1 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
