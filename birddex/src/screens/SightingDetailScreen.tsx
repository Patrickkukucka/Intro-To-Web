import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, typography, rarityColors } from '../theme';
import { useStore } from '../store/useStore';
import { RootStackParamList, Sighting } from '../types';
import RarityBadge from '../components/RarityBadge';
import { supabase } from '../services/supabase';

type RoutePropType = RouteProp<RootStackParamList, 'SightingDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function SightingDetailScreen() {
  const route = useRoute<RoutePropType>();
  const { sightingId } = route.params;
  const { recentSightings } = useStore();
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = recentSightings.find((s) => s.id === sightingId);
    if (cached) {
      setSighting(cached);
      setLoading(false);
      return;
    }
    // Fetch from Supabase if not cached
    const fetch = async () => {
      const { data } = await supabase
        .from('sightings')
        .select('*, birds(*)')
        .eq('id', sightingId)
        .single();
      if (data) {
        setSighting({
          id: data.id,
          userId: data.user_id,
          birdId: data.bird_id,
          bird: data.birds,
          photoUrl: data.photo_url,
          notes: data.notes,
          latitude: data.latitude,
          longitude: data.longitude,
          locationName: data.location_name,
          spottedAt: data.spotted_at,
          createdAt: data.created_at,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [sightingId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  if (!sighting) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Sighting not found.</Text>
      </View>
    );
  }

  const { bird } = sighting;
  const hasLocation = sighting.latitude != null && sighting.longitude != null;
  const rarity = bird?.rarity ?? 'Common';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Photo */}
      <View style={styles.photoContainer}>
        {sighting.photoUrl ? (
          <Image source={{ uri: sighting.photoUrl }} style={styles.photo} />
        ) : bird?.thumbnailUrl ? (
          <Image source={{ uri: bird.thumbnailUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.placeholderEmoji}>🐦</Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', colors.background]}
          style={styles.photoGradient}
        />
      </View>

      {/* Species info */}
      <View style={styles.speciesCard}>
        <View style={styles.speciesHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.commonName}>{bird?.commonName ?? 'Unknown Bird'}</Text>
            <Text style={styles.scientificName}>{bird?.scientificName}</Text>
          </View>
          <RarityBadge rarity={rarity} />
        </View>

        {bird?.family && (
          <View style={styles.taxonomyRow}>
            <Ionicons name="git-branch-outline" size={14} color={colors.textMuted} />
            <Text style={styles.taxonomyText}>{bird.family}</Text>
          </View>
        )}
      </View>

      {/* Sighting details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Sighting Details</Text>

        <View style={styles.detailRow}>
          <View style={styles.detailIconWrap}>
            <Ionicons name="calendar-outline" size={18} color={colors.primaryLight} />
          </View>
          <View>
            <Text style={styles.detailLabel}>Date & Time</Text>
            <Text style={styles.detailValue}>{formatDateTime(sighting.spottedAt)}</Text>
          </View>
        </View>

        {sighting.locationName && (
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="location-outline" size={18} color={colors.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{sighting.locationName}</Text>
            </View>
          </View>
        )}

        {sighting.notes && (
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="document-text-outline" size={18} color={colors.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailValue}>{sighting.notes}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Fun facts */}
      {bird?.funFacts && bird.funFacts.length > 0 && (
        <View style={styles.funFactCard}>
          <Text style={styles.funFactTitle}>About this bird</Text>
          {bird.funFacts.map((fact, i) => (
            <Text key={i} style={styles.funFactText}>
              {fact}
            </Text>
          ))}
        </View>
      )}

      {/* Location coords card (map shown in native build) */}
      {hasLocation && (
        <View style={styles.mapSection}>
          <Text style={styles.mapTitle}>Spotted Here</Text>
          <View style={styles.mapContainer}>
            <View style={styles.coordsCard}>
              <Ionicons name="location" size={28} color={colors.primaryLight} />
              <View>
                <Text style={styles.coordsText}>
                  {sighting.latitude!.toFixed(5)}, {sighting.longitude!.toFixed(5)}
                </Text>
                {sighting.locationName ? (
                  <Text style={styles.coordsLabel}>{sighting.locationName}</Text>
                ) : null}
              </View>
            </View>
            </MapView>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { ...typography.body, color: colors.textSecondary },

  photoContainer: { height: 300, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 80 },
  photoGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },

  speciesCard: {
    margin: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speciesHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.md },
  commonName: { ...typography.h2, color: colors.text },
  scientificName: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  taxonomyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  taxonomyText: { ...typography.caption, color: colors.textMuted },

  detailsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  detailsTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  detailIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  detailLabel: { ...typography.tiny, color: colors.textMuted, marginBottom: 2 },
  detailValue: { ...typography.body, color: colors.text },

  funFactCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  funFactTitle: { ...typography.h4, color: colors.primaryLight, marginBottom: spacing.sm },
  funFactText: { ...typography.body, color: colors.text, lineHeight: 22 },

  mapSection: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  mapTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  mapContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  coordsText: { ...typography.bodyBold, color: colors.text },
  coordsLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
