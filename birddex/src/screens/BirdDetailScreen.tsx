import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, typography, rarityColors } from '../theme';
import { RootStackParamList } from '../types';
import RarityBadge from '../components/RarityBadge';
import { RARITY_FUN_FACTS } from '../services/iNaturalist';
import { useStore } from '../store/useStore';

type RoutePropType = RouteProp<RootStackParamList, 'BirdDetail'>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function BirdDetailScreen() {
  const route = useRoute<RoutePropType>();
  const { birdId, userBird } = route.params;
  const { userBirds } = useStore();

  const ub = userBird ?? userBirds.find((u) => u.birdId === birdId);
  const bird = ub?.bird;

  if (!bird) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Bird not found.</Text>
      </View>
    );
  }

  const rarityColor = rarityColors[bird.rarity];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.heroContainer}>
        {bird.thumbnailUrl ? (
          <Image source={{ uri: bird.thumbnailUrl }} style={styles.heroImage} />
        ) : ub?.firstPhotoUrl ? (
          <Image source={{ uri: ub.firstPhotoUrl }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Text style={styles.placeholderEmoji}>🐦</Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', colors.background]}
          style={styles.heroGradient}
        />
        <View style={[styles.rarityAccent, { backgroundColor: rarityColor }]} />
      </View>

      {/* Names */}
      <View style={styles.nameSection}>
        <RarityBadge rarity={bird.rarity} />
        <Text style={styles.commonName}>{bird.commonName}</Text>
        <Text style={styles.scientificName}>{bird.scientificName}</Text>
      </View>

      {/* Collection stats */}
      {ub && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.statValue}>{ub.timesSeen}×</Text>
            <Text style={styles.statLabel}>Times Seen</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={20} color={colors.primaryLight} />
            <Text style={styles.statValue}>{formatDate(ub.firstSeenAt)}</Text>
            <Text style={styles.statLabel}>First Spotted</Text>
          </View>
        </View>
      )}

      {/* About */}
      {bird.family && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Taxonomy</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Family</Text>
            <Text style={styles.infoValue}>{bird.family}</Text>
          </View>
          {bird.order && (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Order</Text>
              <Text style={styles.infoValue}>{bird.order}</Text>
            </View>
          )}
        </View>
      )}

      {/* Fun facts */}
      {bird.funFacts?.map((fact, i) => (
        <View key={i} style={styles.funFactCard}>
          <Text style={styles.funFactTitle}>About</Text>
          <Text style={styles.funFactText}>{fact}</Text>
        </View>
      ))}

      <View style={styles.rarityCard}>
        <Text style={[styles.rarityLabel, { color: rarityColor }]}>{bird.rarity}</Text>
        <Text style={styles.rarityText}>{RARITY_FUN_FACTS[bird.rarity]}</Text>
        {bird.observationCount != null && (
          <Text style={styles.observationCount}>
            {bird.observationCount.toLocaleString()} global observations
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, color: colors.textSecondary },

  heroContainer: { height: 280, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 80 },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
  rarityAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  nameSection: { padding: spacing.lg, gap: spacing.sm },
  commonName: { ...typography.h1, color: colors.text },
  scientificName: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { ...typography.bodyBold, color: colors.text },
  statLabel: { ...typography.tiny, color: colors.textMuted },
  statDivider: { width: 1, backgroundColor: colors.border },

  infoCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey: { ...typography.caption, color: colors.textMuted },
  infoValue: { ...typography.caption, color: colors.text },

  funFactCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  funFactTitle: { ...typography.captionBold, color: colors.primaryLight, marginBottom: spacing.xs },
  funFactText: { ...typography.body, color: colors.text, lineHeight: 22 },

  rarityCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  rarityLabel: { ...typography.h4 },
  rarityText: { ...typography.body, color: colors.textSecondary, lineHeight: 20 },
  observationCount: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
