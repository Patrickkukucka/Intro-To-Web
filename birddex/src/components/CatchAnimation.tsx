import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, radius, typography, rarityColors } from '../theme';
import { IdentificationResult } from '../types';
import RarityBadge from './RarityBadge';
import { useStore } from '../store/useStore';

const { width: W, height: H } = Dimensions.get('window');

const SPARKLES = ['✦', '★', '✺', '✸', '◆', '⬟'];

function Sparkle({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 400 })));
    scale.value = withDelay(delay, withSequence(withSpring(1.2), withTiming(0, { duration: 400 })));
    translateY.value = withDelay(delay, withTiming(-60, { duration: 700 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.Text
      style={[
        { position: 'absolute', left: x, top: y, fontSize: size, color: colors.accent },
        style,
      ]}
    >
      {SPARKLES[Math.floor(Math.random() * SPARKLES.length)]}
    </Animated.Text>
  );
}

interface Props {
  result: IdentificationResult;
  onDismiss: () => void;
}

export default function CatchAnimation({ result, onDismiss }: Props) {
  const { bird } = result;
  const rarityColor = rarityColors[bird.rarity];

  // Animation values
  const ballScale = useSharedValue(1);
  const ballOpacity = useSharedValue(1);
  const cardTranslateY = useSharedValue(H * 0.4);
  const cardOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const shake = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const triggerHaptics = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 1200);
  }, []);

  useEffect(() => {
    runOnJS(triggerHaptics)();

    // Fade in overlay
    overlayOpacity.value = withTiming(1, { duration: 300 });

    // Shake the "ball" 3 times
    shake.value = withSequence(
      withTiming(12, { duration: 120 }),
      withTiming(-12, { duration: 120 }),
      withTiming(12, { duration: 120 }),
      withTiming(-12, { duration: 120 }),
      withTiming(12, { duration: 120 }),
      withTiming(-12, { duration: 120 }),
      withTiming(0, { duration: 120 }),
    );

    // Pop and glow
    ballScale.value = withDelay(900, withSequence(
      withSpring(1.4, { damping: 3, stiffness: 200 }),
      withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }),
    ));
    ballOpacity.value = withDelay(1100, withTiming(0, { duration: 300 }));
    glowOpacity.value = withDelay(900, withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0, { duration: 600 }),
    ));

    // Slide card up
    cardTranslateY.value = withDelay(1300, withSpring(0, { damping: 14, stiffness: 120 }));
    cardOpacity.value = withDelay(1300, withTiming(1, { duration: 300 }));
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ballScale.value }, { translateX: shake.value }],
    opacity: ballOpacity.value,
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
    opacity: cardOpacity.value,
  }));

  const sparklePositions = Array.from({ length: 12 }, (_, i) => ({
    x: W * 0.2 + Math.random() * W * 0.6,
    y: H * 0.2 + Math.random() * H * 0.3,
    size: 12 + Math.random() * 16,
    delay: 900 + Math.random() * 300,
  }));

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
        {/* Background image blur */}
        {result.photoUrl ? (
          <Image
            source={{ uri: result.photoUrl }}
            style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
            blurRadius={20}
          />
        ) : null}

        {/* Sparkles */}
        {sparklePositions.map((s, i) => (
          <Sparkle key={i} {...s} />
        ))}

        {/* Glow burst */}
        <Animated.View style={[styles.glowBurst, { backgroundColor: rarityColor }, glowStyle]} />

        {/* Ball representation */}
        <Animated.View style={[styles.ballContainer, ballStyle]}>
          {result.photoUrl ? (
            <Image source={{ uri: result.photoUrl }} style={styles.ballImage} />
          ) : (
            <View style={[styles.ballPlaceholder, { backgroundColor: rarityColor + '33' }]}>
              <Text style={styles.ballEmoji}>🐦</Text>
            </View>
          )}
          <View style={[styles.ballRing, { borderColor: rarityColor }]} />
        </Animated.View>

        {/* Result card */}
        <Animated.View style={[styles.resultCard, cardStyle]}>
          <Text style={styles.newSpeciesLabel}>✨ New Species Discovered!</Text>
          {result.photoUrl && (
            <Image source={{ uri: result.photoUrl }} style={styles.cardPhoto} />
          )}
          <View style={styles.cardContent}>
            <RarityBadge rarity={bird.rarity} />
            <Text style={styles.birdName}>{bird.commonName}</Text>
            <Text style={styles.birdScientific}>{bird.scientificName}</Text>
            {bird.funFacts?.[0] && (
              <Text style={styles.funFact} numberOfLines={3}>
                {bird.funFacts[0]}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.dismissBtn, { backgroundColor: rarityColor }]}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.dismissBtnText}>Added to BirdDex!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowBurst: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0,
    alignSelf: 'center',
    top: H * 0.2,
  },
  ballContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    position: 'absolute',
    top: H * 0.25,
    alignSelf: 'center',
  },
  ballImage: { width: '100%', height: '100%', borderRadius: 75 },
  ballPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballEmoji: { fontSize: 64 },
  ballRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 75,
    borderWidth: 4,
    width: 150,
    height: 150,
  },

  resultCard: {
    position: 'absolute',
    bottom: 80,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  newSpeciesLabel: {
    ...typography.bodyBold,
    color: colors.accent,
    textAlign: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  cardPhoto: { width: '100%', height: 180 },
  cardContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  birdName: { ...typography.h2, color: colors.text },
  birdScientific: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  funFact: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  dismissBtn: {
    margin: spacing.md,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissBtnText: { ...typography.h4, color: colors.background },
});
