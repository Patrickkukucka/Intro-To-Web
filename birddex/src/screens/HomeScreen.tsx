import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, radius, typography, rarityColors, shadows } from '../theme';
import { useStore } from '../store/useStore';
import { RootStackParamList, Sighting } from '../types';
import RarityBadge from '../components/RarityBadge';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

function SightingCard({ sighting }: { sighting: Sighting }) {
  const navigation = useNavigation<Nav>();
  const rarity = sighting.bird?.rarity ?? 'Common';

  return (
    <TouchableOpacity
      style={styles.sightingCard}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('SightingDetail', { sightingId: sighting.id })}
    >
      {sighting.photoUrl ? (
        <Image source={{ uri: sighting.photoUrl }} style={styles.sightingPhoto} />
      ) : (
        <View style={[styles.sightingPhoto, styles.sightingPhotoPlaceholder]}>
          <Text style={styles.sightingPhotoEmoji}>🐦</Text>
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.sightingGradient}
      />
      <View style={styles.sightingInfo}>
        <RarityBadge rarity={rarity} small />
        <Text style={styles.sightingName} numberOfLines={1}>
          {sighting.bird?.commonName ?? 'Unknown Bird'}
        </Text>
        <Text style={styles.sightingScientific} numberOfLines={1}>
          {sighting.bird?.scientificName}
        </Text>
        <View style={styles.sightingMeta}>
          <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
          <Text style={styles.sightingMetaText}>{formatDate(sighting.spottedAt)}</Text>
          {sighting.locationName && (
            <>
              <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.sightingMetaText} numberOfLines={1}>{sighting.locationName}</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatsBar() {
  const { userBirds, profile, totalSpecies } = useStore();
  const streak = profile?.streakCount ?? 0;

  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{userBirds.length}</Text>
        <Text style={styles.statLabel}>Caught</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalSpecies.toLocaleString()}</Text>
        <Text style={styles.statLabel}>Total Species</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.accent }]}>{streak}</Text>
        <Text style={styles.statLabel}>Day Streak 🔥</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { session, profile, recentSightings, loadRecentSightings, loadUserBirds, updateStreak } =
    useStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const userId = session?.user.id;

  const loadData = useCallback(async () => {
    if (!userId) return;
    await Promise.all([loadRecentSightings(userId), loadUserBirds(userId)]);
    await updateStreak(userId);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {profile?.username ?? 'Birder'} 👋
          </Text>
          <Text style={styles.headerSub}>What have you spotted today?</Text>
        </View>
        <View style={styles.headerRight}>
          {profile?.isPro && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
      </View>

      <StatsBar />

      <FlatList
        data={recentSightings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SightingCard sighting={item} />}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Recent Sightings</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔭</Text>
            <Text style={styles.emptyTitle}>No sightings yet</Text>
            <Text style={styles.emptyText}>
              Tap the camera tab to identify your first bird!
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryLight}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  greeting: { ...typography.h3, color: colors.text },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  proBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: { ...typography.tiny, color: colors.background, fontWeight: '700' },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h2, color: colors.text, fontSize: 20 },
  statLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  listContent: { paddingBottom: 100 },

  sightingCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 180,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  sightingPhoto: { width: '100%', height: '100%', position: 'absolute' },
  sightingPhotoPlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sightingPhotoEmoji: { fontSize: 56 },
  sightingGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  sightingInfo: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  sightingName: { ...typography.h4, color: colors.text, marginTop: spacing.xs },
  sightingScientific: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  sightingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sightingMetaText: { ...typography.tiny, color: colors.textSecondary },

  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
