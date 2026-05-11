import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, radius, typography, rarityColors, shadows } from '../theme';
import { useStore } from '../store/useStore';
import { signOut } from '../services/supabase';
import { Badge } from '../types';
import RarityBadge from '../components/RarityBadge';
import CalendarHeatmap from '../components/CalendarHeatmap';

function AvatarPlaceholder({ username }: { username: string }) {
  return (
    <View style={styles.avatarPlaceholder}>
      <Text style={styles.avatarInitial}>{username[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <View style={[styles.badgeCard, badge.locked && styles.badgeCardLocked]}>
      <Text style={[styles.badgeIcon, badge.locked && styles.badgeIconLocked]}>
        {badge.locked ? '🔒' : badge.icon}
      </Text>
      <Text style={[styles.badgeName, badge.locked && styles.badgeNameLocked]}>
        {badge.name}
      </Text>
      <Text style={styles.badgeDesc} numberOfLines={2}>
        {badge.description}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile, userBirds, recentSightings, loadProfile, loadUserBirds, reset } = useStore();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) {
      loadProfile(userId);
      loadUserBirds(userId);
    }
  }, [userId]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          reset();
        },
      },
    ]);
  };

  if (!profile) return null;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const sightingDates = recentSightings.map((s) => s.spottedAt.split('T')[0]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <LinearGradient
          colors={[colors.primaryDark, colors.background]}
          style={styles.headerGradient}
        >
          <View style={styles.headerActions}>
            <View />
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.avatarRow}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <AvatarPlaceholder username={profile.username} />
            )}
            {profile.isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>

          <Text style={styles.username}>{profile.username}</Text>
          <Text style={styles.joinDate}>Birder since {joinDate}</Text>

          <View style={styles.streakRow}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{profile.streakCount} day streak</Text>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard label="Birds Logged" value={String(profile.totalBirds)} icon="🐦" />
          <StatCard
            label="Rarest Bird"
            value={profile.rarestBird?.rarity ?? '—'}
            icon={
              profile.rarestBird?.rarity === 'Legendary'
                ? '🌟'
                : profile.rarestBird?.rarity === 'Rare'
                ? '💜'
                : '🔍'
            }
          />
          <StatCard label="Day Streak" value={String(profile.streakCount)} icon="⚡" />
          <StatCard
            label="Unique Species"
            value={String(new Set(userBirds.map((ub) => ub.birdId)).size)}
            icon="🧬"
          />
        </View>

        {/* Rarest Bird */}
        {profile.rarestBird && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rarest Catch</Text>
            <View style={[styles.rarestCard, { borderColor: rarityColors[profile.rarestBird.rarity] + '66' }]}>
              <View style={styles.rarestContent}>
                <Text style={styles.rarestName}>{profile.rarestBird.commonName}</Text>
                <Text style={styles.rarestScientific}>{profile.rarestBird.scientificName}</Text>
                <RarityBadge rarity={profile.rarestBird.rarity} />
              </View>
              {profile.rarestBird.thumbnailUrl ? (
                <Image source={{ uri: profile.rarestBird.thumbnailUrl }} style={styles.rarestImage} />
              ) : (
                <Text style={styles.rarestEmoji}>🦅</Text>
              )}
            </View>
          </View>
        )}

        {/* Activity Heatmap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <CalendarHeatmap dates={sightingDates} />
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgesGrid}>
            {profile.badges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </View>
        </View>

        {/* Pro Upsell */}
        {!profile.isPro && (
          <View style={styles.proCard}>
            <LinearGradient
              colors={[colors.primaryDark, colors.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proCardGradient}
            >
              <Text style={styles.proCardEmoji}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.proCardTitle}>Go Pro — Unlimited Birds</Text>
                <Text style={styles.proCardText}>
                  Unlock unlimited logging, rare alerts, and more.
                </Text>
              </View>
              <TouchableOpacity style={styles.proCardBtn}>
                <Text style={styles.proCardBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 100 },

  headerGradient: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  signOutBtn: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
  },

  avatarRow: { alignItems: 'center', position: 'relative', marginBottom: spacing.md },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: colors.primaryLight },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  avatarInitial: { ...typography.h1, color: colors.text },
  proBadge: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: { ...typography.tiny, color: colors.background, fontWeight: '700' },

  username: { ...typography.h2, color: colors.text, textAlign: 'center' },
  joinDate: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  streakEmoji: { fontSize: 18 },
  streakText: { ...typography.bodyBold, color: colors.accent },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIcon: { fontSize: 24, marginBottom: spacing.xs },
  statValue: { ...typography.h2, color: colors.text, fontSize: 22 },
  statLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },

  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.md },

  rarestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  rarestContent: { flex: 1, gap: spacing.xs },
  rarestName: { ...typography.h4, color: colors.text },
  rarestScientific: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  rarestImage: { width: 64, height: 64, borderRadius: radius.md },
  rarestEmoji: { fontSize: 48 },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  badgeCardLocked: { opacity: 0.45 },
  badgeIcon: { fontSize: 28 },
  badgeIconLocked: { opacity: 0.5 },
  badgeName: { ...typography.captionBold, color: colors.text, textAlign: 'center' },
  badgeNameLocked: { color: colors.textMuted },
  badgeDesc: { ...typography.tiny, color: colors.textMuted, textAlign: 'center' },

  proCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  proCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  proCardEmoji: { fontSize: 28 },
  proCardTitle: { ...typography.bodyBold, color: colors.accent },
  proCardText: { ...typography.caption, color: colors.textSecondary },
  proCardBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  proCardBtnText: { ...typography.captionBold, color: colors.background },
});
