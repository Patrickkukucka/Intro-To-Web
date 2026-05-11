import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, radius, typography, shadows } from '../theme';

const PRO_FEATURES = [
  { icon: '🐦', title: 'Unlimited Birds', desc: 'Log as many species as you find — no cap.' },
  { icon: '🔔', title: 'Rare Bird Alerts', desc: 'Get notified when rare species are spotted near you.' },
  { icon: '🗺️', title: 'Full Map History', desc: 'View all your sighting pins on an interactive map.' },
  { icon: '📊', title: 'Advanced Stats', desc: 'Detailed analytics on your birding habits.' },
  { icon: '🏆', title: 'Pro Leaderboard Badge', desc: 'Stand out with a gold PRO badge on the leaderboard.' },
  { icon: '💾', title: 'Unlimited Photo Storage', desc: 'Store every photo from every sighting.' },
];

export default function ProUpgradeScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[colors.primaryDark, colors.background]}
        style={styles.heroGradient}
      >
        <Text style={styles.heroEmoji}>⭐</Text>
        <Text style={styles.heroTitle}>BirdDex Pro</Text>
        <Text style={styles.heroSub}>Unlock the full birding experience</Text>

        <View style={styles.limitNote}>
          <Ionicons name="lock-closed" size={16} color={colors.accent} />
          <Text style={styles.limitText}>
            Free accounts are limited to 20 unique species. Upgrade to log unlimited birds.
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>Everything included</Text>
        {PRO_FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.primaryLight} />
          </View>
        ))}
      </View>

      <View style={styles.pricingSection}>
        <View style={[styles.planCard, styles.planCardHighlighted]}>
          <View style={styles.planBestValue}>
            <Text style={styles.planBestValueText}>BEST VALUE</Text>
          </View>
          <Text style={styles.planPeriod}>Annual</Text>
          <Text style={styles.planPrice}>$29.99<Text style={styles.planPriceUnit}>/yr</Text></Text>
          <Text style={styles.planSaving}>Save 50% vs monthly</Text>
        </View>
        <View style={styles.planCard}>
          <Text style={styles.planPeriod}>Monthly</Text>
          <Text style={styles.planPrice}>$4.99<Text style={styles.planPriceUnit}>/mo</Text></Text>
          <Text style={styles.planSaving}>Cancel anytime</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.ctaBtn}>
        <LinearGradient
          colors={[colors.accent, '#F4845F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaBtnGradient}
        >
          <Text style={styles.ctaBtnText}>Start 7-Day Free Trial</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        No charge during trial. Cancel before trial ends to avoid billing.
        Payments processed via App Store / Google Play.
      </Text>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.notNow}>
        <Text style={styles.notNowText}>Not now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  heroGradient: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  heroEmoji: { fontSize: 64, marginBottom: spacing.md },
  heroTitle: { ...typography.h1, color: colors.text, fontSize: 32 },
  heroSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  limitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.proGlow,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  limitText: { ...typography.caption, color: colors.accent, flex: 1, lineHeight: 18 },

  featuresSection: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  featuresTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIcon: { fontSize: 24 },
  featureTitle: { ...typography.bodyBold, color: colors.text },
  featureDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  pricingSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardHighlighted: { borderColor: colors.accent },
  planBestValue: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  planBestValueText: { ...typography.tiny, color: colors.background, fontWeight: '700' },
  planPeriod: { ...typography.captionBold, color: colors.textSecondary, textTransform: 'uppercase' },
  planPrice: { ...typography.h2, color: colors.text, fontSize: 26 },
  planPriceUnit: { ...typography.body, color: colors.textMuted, fontSize: 14 },
  planSaving: { ...typography.tiny, color: colors.textMuted, textAlign: 'center' },

  ctaBtn: { marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', ...shadows.md },
  ctaBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  ctaBtnText: { ...typography.h4, color: colors.background, fontSize: 16 },

  disclaimer: {
    ...typography.tiny,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    lineHeight: 16,
  },
  notNow: { alignItems: 'center', marginTop: spacing.lg },
  notNowText: { ...typography.body, color: colors.textSecondary },
});
