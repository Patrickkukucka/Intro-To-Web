import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, radius, typography, rarityColors, shadows } from '../theme';
import { useStore } from '../store/useStore';
import { LeaderboardEntry } from '../types';
import RarityBadge from '../components/RarityBadge';

const COUNTRY_FILTERS = [
  { code: undefined, label: '🌍 Global' },
  { code: 'US', label: '🇺🇸 USA' },
  { code: 'GB', label: '🇬🇧 UK' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'CA', label: '🇨🇦 Canada' },
  { code: 'IN', label: '🇮🇳 India' },
];

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const medal = RANK_MEDAL[entry.rank];

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowHighlighted,
        entry.rank <= 3 && styles.rowTop3,
      ]}
    >
      <View style={styles.rankContainer}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={[styles.rank, entry.rank <= 10 && styles.rankTop10]}>
            {entry.rank}
          </Text>
        )}
      </View>

      {entry.avatarUrl ? (
        <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{entry.username[0]?.toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.userInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username} numberOfLines={1}>
            {entry.username}
          </Text>
          {entry.isPro && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          )}
        </View>
        {entry.rarestCatch && (
          <View style={styles.rarestRow}>
            <Text style={styles.rarestLabel}>Rarest: </Text>
            <Text
              style={[styles.rarestName, { color: rarityColors[entry.rarestCatch.rarity] }]}
              numberOfLines={1}
            >
              {entry.rarestCatch.commonName}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.birdCount}>
        <Text style={styles.birdCountValue}>{entry.totalBirds}</Text>
        <Text style={styles.birdCountLabel}>birds</Text>
      </View>
    </View>
  );
}

function TopThreePodium({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length < 1) return null;
  const [first, second, third] = entries;

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.card]}
      style={styles.podium}
    >
      {/* Second place */}
      {second && (
        <View style={[styles.podiumItem, { marginTop: spacing.xl }]}>
          <View style={styles.podiumAvatarContainer}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarSilver]}>
              <Text style={styles.podiumInitial}>{second.username[0]?.toUpperCase()}</Text>
            </View>
            {second.isPro && <View style={styles.podiumPro}><Text style={styles.podiumProText}>PRO</Text></View>}
          </View>
          <Text style={styles.podiumMedal}>🥈</Text>
          <Text style={styles.podiumName} numberOfLines={1}>{second.username}</Text>
          <Text style={styles.podiumBirds}>{second.totalBirds}</Text>
        </View>
      )}

      {/* First place */}
      {first && (
        <View style={styles.podiumItem}>
          <View style={styles.podiumAvatarContainer}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarGold]}>
              <Text style={styles.podiumInitial}>{first.username[0]?.toUpperCase()}</Text>
            </View>
            {first.isPro && <View style={styles.podiumPro}><Text style={styles.podiumProText}>PRO</Text></View>}
          </View>
          <Text style={styles.podiumMedal}>🥇</Text>
          <Text style={styles.podiumName} numberOfLines={1}>{first.username}</Text>
          <Text style={styles.podiumBirds}>{first.totalBirds}</Text>
        </View>
      )}

      {/* Third place */}
      {third && (
        <View style={[styles.podiumItem, { marginTop: spacing.xl * 1.5 }]}>
          <View style={styles.podiumAvatarContainer}>
            <View style={[styles.podiumAvatar, styles.podiumAvatarBronze]}>
              <Text style={styles.podiumInitial}>{third.username[0]?.toUpperCase()}</Text>
            </View>
            {third.isPro && <View style={styles.podiumPro}><Text style={styles.podiumProText}>PRO</Text></View>}
          </View>
          <Text style={styles.podiumMedal}>🥉</Text>
          <Text style={styles.podiumName} numberOfLines={1}>{third.username}</Text>
          <Text style={styles.podiumBirds}>{third.totalBirds}</Text>
        </View>
      )}
    </LinearGradient>
  );
}

export default function LeaderboardScreen() {
  const { session, leaderboard, loadLeaderboard, isLoadingLeaderboard } = useStore();
  const [activeCountry, setActiveCountry] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadLeaderboard(activeCountry); }, [activeCountry]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard(activeCountry);
    setRefreshing(false);
  };

  const currentUserId = session?.user.id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.headerIcon}>
          <Ionicons name="trophy" size={22} color={colors.accent} />
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={COUNTRY_FILTERS}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeCountry === item.code && styles.filterChipActive,
              ]}
              onPress={() => setActiveCountry(item.code)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCountry === item.code && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoadingLeaderboard && leaderboard.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      ) : (
        <FlatList
          data={leaderboard.slice(3)}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={
            <>
              <TopThreePodium entries={leaderboard.slice(0, 3)} />
              <View style={styles.proNote}>
                <Ionicons name="star" size={12} color={colors.accent} />
                <Text style={styles.proNoteText}>
                  PRO users get rare bird alerts and exclusive leaderboard badges.
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <LeaderboardRow
              entry={item}
              isCurrentUser={item.userId === currentUserId}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryLight}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyText}>Be the first to log birds in this region!</Text>
            </View>
          }
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
  headerIcon: {
    backgroundColor: colors.card,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  filterRow: { marginBottom: spacing.sm },
  filterList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryLight },
  filterChipText: { ...typography.captionBold, color: colors.textSecondary },
  filterChipTextActive: { color: colors.text },

  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumAvatarContainer: { position: 'relative', marginBottom: spacing.xs },
  podiumAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  podiumAvatarGold: { backgroundColor: colors.cardElevated, borderColor: '#FFD700' },
  podiumAvatarSilver: { backgroundColor: colors.cardElevated, borderColor: '#C0C0C0' },
  podiumAvatarBronze: { backgroundColor: colors.cardElevated, borderColor: '#CD7F32' },
  podiumInitial: { ...typography.h3, color: colors.text },
  podiumPro: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  podiumProText: { ...typography.tiny, color: colors.background, fontWeight: '700', fontSize: 8 },
  podiumMedal: { fontSize: 20, marginTop: 4 },
  podiumName: { ...typography.captionBold, color: colors.text, marginTop: 2 },
  podiumBirds: { ...typography.tiny, color: colors.primaryLight },

  proNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.proGlow,
    marginHorizontal: spacing.lg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  proNoteText: { ...typography.tiny, color: colors.accent, flex: 1 },

  listContent: { paddingBottom: 100 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowHighlighted: { backgroundColor: colors.primaryDark + '33' },
  rowTop3: { backgroundColor: colors.card },

  rankContainer: { width: 32, alignItems: 'center' },
  rank: { ...typography.bodyBold, color: colors.textMuted },
  rankTop10: { color: colors.primaryLight },
  medal: { fontSize: 20 },

  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { ...typography.bodyBold, color: colors.text },

  userInfo: { flex: 1, minWidth: 0 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  username: { ...typography.bodyBold, color: colors.text, flexShrink: 1 },
  proBadge: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  proBadgeText: { ...typography.tiny, color: colors.background, fontWeight: '700', fontSize: 9 },
  youBadge: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  youBadgeText: { ...typography.tiny, color: colors.text, fontWeight: '700', fontSize: 9 },
  rarestRow: { flexDirection: 'row', alignItems: 'center' },
  rarestLabel: { ...typography.tiny, color: colors.textMuted },
  rarestName: { ...typography.tiny, fontWeight: '600', flexShrink: 1 },

  birdCount: { alignItems: 'flex-end', minWidth: 48 },
  birdCountValue: { ...typography.h4, color: colors.primaryLight },
  birdCountLabel: { ...typography.tiny, color: colors.textMuted },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
