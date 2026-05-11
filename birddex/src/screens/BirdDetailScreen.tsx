import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, typography, rarityColors } from '../theme';
import { RootStackParamList } from '../types';
import RarityBadge from '../components/RarityBadge';
import { RARITY_FUN_FACTS, fetchBirdBiography } from '../services/iNaturalist';
import {
  BirdBiography,
  SEED_BIRD_BIOGRAPHIES,
  CONSERVATION_COLORS,
  CONSERVATION_LABELS,
} from '../data/birdBiographies';
import { useStore } from '../store/useStore';

type RoutePropType = RouteProp<RootStackParamList, 'BirdDetail'>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

interface BiographyRowProps {
  icon: string;
  label: string;
  text: string;
}

function BiographyRow({ icon, label, text }: BiographyRowProps) {
  return (
    <View style={styles.bioRow}>
      <View style={styles.bioIconWrap}>
        <Text style={styles.bioIcon}>{icon}</Text>
      </View>
      <View style={styles.bioTextWrap}>
        <Text style={styles.bioLabel}>{label}</Text>
        <Text style={styles.bioText}>{text}</Text>
      </View>
    </View>
  );
}

function ConservationBadge({ code, label }: { code: string; label: string }) {
  const color = CONSERVATION_COLORS[code as keyof typeof CONSERVATION_COLORS] ?? colors.textMuted;
  return (
    <View style={[styles.conservationBadge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
      <View style={[styles.conservationDot, { backgroundColor: color }]} />
      <Text style={[styles.conservationCode, { color }]}>{code}</Text>
      <Text style={styles.conservationLabel}>{label}</Text>
    </View>
  );
}

export default function BirdDetailScreen() {
  const route = useRoute<RoutePropType>();
  const { birdId, userBird } = route.params;
  const { userBirds } = useStore();
  const [biography, setBiography] = useState<BirdBiography | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const ub = userBird ?? userBirds.find((u) => u.birdId === birdId);
  const bird = ub?.bird;

  useEffect(() => {
    if (!bird) return;

    // 1. Check pre-written seed biographies first
    const seedBio = SEED_BIRD_BIOGRAPHIES[bird.id];
    if (seedBio) {
      setBiography(seedBio);
      return;
    }

    // 2. For iNaturalist-identified birds (id = "inat-TAXON_ID")
    if (bird.id.startsWith('inat-')) {
      const taxonId = parseInt(bird.id.replace('inat-', ''), 10);
      if (!isNaN(taxonId)) {
        setBioLoading(true);
        fetchBirdBiography(taxonId)
          .then((bio) => { if (bio) setBiography(bio); })
          .finally(() => setBioLoading(false));
      }
      return;
    }

    // 3. Fallback: build a minimal bio from whatever the bird record has
    if (bird.funFacts?.length) {
      setBiography({
        summary: bird.funFacts[0],
        habitat: 'Habitat data not available for this species.',
        diet: 'Diet data not available for this species.',
        behavior: 'Behavioral data not available for this species.',
        funFact: bird.funFacts[1] ?? RARITY_FUN_FACTS[bird.rarity],
        conservationStatus: 'Not Evaluated',
        conservationCode: 'NE',
      });
    }
  }, [bird?.id]);

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

      {/* ──────────────── ABOUT THIS BIRD ──────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>About this bird</Text>
          {bioLoading && (
            <ActivityIndicator size="small" color={colors.primaryLight} />
          )}
        </View>

        {biography ? (
          <View style={styles.biographyCard}>
            {/* Summary paragraph */}
            <Text style={styles.bioSummary}>{biography.summary}</Text>

            <View style={styles.bioDivider} />

            {/* Structured rows */}
            <BiographyRow icon="🌿" label="Habitat" text={biography.habitat} />
            <BiographyRow icon="🍽️" label="Diet" text={biography.diet} />
            <BiographyRow icon="🎵" label="Behavior" text={biography.behavior} />

            {biography.funFact ? (
              <View style={styles.funFactBox}>
                <Text style={styles.funFactBoxLabel}>✨ Fun Fact</Text>
                <Text style={styles.funFactBoxText}>{biography.funFact}</Text>
              </View>
            ) : null}

            {/* Conservation status */}
            <View style={styles.conservationRow}>
              <Text style={styles.conservationTitle}>Conservation Status</Text>
              <ConservationBadge
                code={biography.conservationCode}
                label={biography.conservationStatus || CONSERVATION_LABELS[biography.conservationCode]}
              />
            </View>
          </View>
        ) : !bioLoading ? (
          <View style={styles.biographyCard}>
            <Text style={styles.bioSummary}>
              {RARITY_FUN_FACTS[bird.rarity]}
            </Text>
            {bird.observationCount != null && (
              <Text style={styles.observationCount}>
                {bird.observationCount.toLocaleString()} global observations on iNaturalist
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Taxonomy */}
      {(bird.family || bird.order) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Taxonomy</Text>
          <View style={styles.taxonomyCard}>
            {bird.order && (
              <View style={styles.taxRow}>
                <Text style={styles.taxKey}>Order</Text>
                <Text style={styles.taxValue}>{bird.order}</Text>
              </View>
            )}
            {bird.family && (
              <View style={styles.taxRow}>
                <Text style={styles.taxKey}>Family</Text>
                <Text style={styles.taxValue}>{bird.family}</Text>
              </View>
            )}
            <View style={styles.taxRow}>
              <Text style={styles.taxKey}>Species</Text>
              <Text style={[styles.taxValue, { fontStyle: 'italic' }]}>{bird.scientificName}</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: { ...typography.body, color: colors.textSecondary },

  heroContainer: { height: 300, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: { fontSize: 80 },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  rarityAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  nameSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  commonName: { ...typography.h1, color: colors.text },
  scientificName: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { ...typography.bodyBold, color: colors.text, textAlign: 'center' },
  statLabel: { ...typography.tiny, color: colors.textMuted },
  statDivider: { width: 1, backgroundColor: colors.border },

  // ── Section ──────────────────────────────────────────────
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h4, color: colors.text },

  // ── Biography card ────────────────────────────────────────
  biographyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  bioSummary: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  bioDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bioIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bioIcon: { fontSize: 18 },
  bioTextWrap: { flex: 1 },
  bioLabel: {
    ...typography.captionBold,
    color: colors.primaryLight,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 10,
  },
  bioText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
  },

  funFactBox: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  funFactBoxLabel: {
    ...typography.captionBold,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  funFactBoxText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
  },

  conservationRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  conservationTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 10,
  },
  conservationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  conservationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  conservationCode: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  conservationLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  observationCount: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // ── Taxonomy ──────────────────────────────────────────────
  taxonomyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  taxKey: { ...typography.caption, color: colors.textMuted },
  taxValue: { ...typography.caption, color: colors.text },
});
