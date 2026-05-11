/**
 * CatchAnimation
 *
 * Full-screen sequence (~3 s) when a new species is logged for the first time.
 *
 * Phase 1  0.0 – 0.2 s   Dark overlay fades in
 * Phase 2  0.1 – 1.5 s   12 chaos birds fly in from screen edges, flutter, and
 *                          spiral into the center vortex (staggered 80 ms apart)
 * Phase 3  1.0 – 1.5 s   Chaos birds dissolve as they reach center
 * Phase 4  1.55 – 2.25 s  Large bird swoops in from right, arcs, and lands
 * Phase 5  2.1 – 2.35 s  Bird folds wings, then fades → badge appears
 * Phase 6  2.35 – 3.05 s  Badge scales up (spring), glow ring pulses × 3
 * Phase 7  2.85 – 3.25 s  "New Species Discovered!" + bird name slide up
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { colors, rarityColors } from '../theme';
import { IdentificationResult } from '../types';
import RarityBadge from './RarityBadge';

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;

// ─── Silhouette SVG path (seagull viewed from below) ─────────────────────────
// Two swept wings meeting at the body — recognisable at any size
const BIRD_PATH =
  'M -10,4 Q -6,-8 0,-2 Q 6,-8 10,4 Q 5,0 0,2 Q -5,0 -10,4 Z';

// Larger version for the landing bird
const BIG_BIRD_PATH =
  'M -36,14 Q -22,-28 0,-8 Q 22,-28 36,14 Q 18,2 0,8 Q -18,2 -36,14 Z';

// ─── Edge position generator ─────────────────────────────────────────────────
function randomEdge(): { x: number; y: number } {
  const edge = Math.floor(Math.random() * 4);
  const pad = 32;
  switch (edge) {
    case 0: return { x: Math.random() * W, y: -pad };
    case 1: return { x: W + pad, y: Math.random() * H };
    case 2: return { x: Math.random() * W, y: H + pad };
    default: return { x: -pad, y: Math.random() * H };
  }
}

// ─── Single chaos bird ───────────────────────────────────────────────────────
interface ChaosBirdProps {
  startX: number;
  startY: number;
  delay: number;
  scale: number;
  initRot: number;
}

function ChaosBird({ startX, startY, delay, scale: birdScale, initRot }: ChaosBirdProps) {
  const x = useSharedValue(startX);
  const y = useSharedValue(startY);
  const rot = useSharedValue(initRot);
  const sc = useSharedValue(0);
  const op = useSharedValue(0);
  const flutter = useSharedValue(1);

  useEffect(() => {
    const flightMs = 700 + Math.random() * 400;    // 700 – 1100 ms
    const p1 = flightMs * 0.52;
    const p2 = flightMs * 0.48;
    const midX = CX + (Math.random() - 0.5) * 180;
    const midY = CY + (Math.random() - 0.5) * 180;

    // Appear
    op.value = withDelay(delay, withTiming(1, { duration: 180 }));
    sc.value = withDelay(delay, withSpring(birdScale, { damping: 10, stiffness: 220 }));

    // Wing flutter (rapid scaleX oscillation)
    flutter.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: 85, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.55, { duration: 85, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );

    // Two-stage flight: chaotic arc → vortex pull
    x.value = withDelay(
      delay,
      withSequence(
        withTiming(midX, { duration: p1, easing: Easing.out(Easing.quad) }),
        withTiming(CX, { duration: p2, easing: Easing.in(Easing.cubic) }),
      ),
    );
    y.value = withDelay(
      delay,
      withSequence(
        withTiming(midY, { duration: p1, easing: Easing.out(Easing.quad) }),
        withTiming(CY, { duration: p2, easing: Easing.in(Easing.cubic) }),
      ),
    );

    // Spins faster near center
    rot.value = withDelay(
      delay,
      withSequence(
        withTiming(initRot + 150 + Math.random() * 120, { duration: p1 }),
        withTiming(initRot + 150 + Math.random() * 120 + 540, {
          duration: p2,
          easing: Easing.in(Easing.quad),
        }),
      ),
    );

    // Dissolve as they reach center
    const dissolveAt = delay + flightMs - 260;
    op.value = withDelay(dissolveAt, withTiming(0, { duration: 280 }));
    sc.value = withDelay(dissolveAt + 80, withTiming(0, { duration: 200 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value - 12,
    top: y.value - 8,
    opacity: op.value,
    transform: [
      { rotate: `${rot.value}deg` },
      { scale: sc.value },
      { scaleX: flutter.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Svg width={24} height={16} viewBox="-12 -8 24 16">
        <Path d={BIRD_PATH} fill="rgba(255,255,255,0.88)" />
      </Svg>
    </Animated.View>
  );
}

// ─── Landing bird ─────────────────────────────────────────────────────────────
function LandingBird({ rarityColor }: { rarityColor: string }) {
  const x = useSharedValue(W + 90);
  const y = useSharedValue(CY - 100);
  const rot = useSharedValue(-22);
  const scX = useSharedValue(1.6);
  const scY = useSharedValue(1.6);
  const op = useSharedValue(0);

  const DELAY = 1550;

  useEffect(() => {
    op.value = withDelay(DELAY, withTiming(1, { duration: 130 }));

    // Swoop to center — slight upswing then settle
    x.value = withDelay(DELAY, withTiming(CX - 40, { duration: 620, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(
      DELAY,
      withSequence(
        withTiming(CY - 70, { duration: 200, easing: Easing.out(Easing.sine) }),
        withSpring(CY - 38, { damping: 11, stiffness: 110 }),
      ),
    );

    // Level out in flight then settle
    rot.value = withDelay(
      DELAY,
      withSequence(
        withTiming(6, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 7, stiffness: 120 }),
      ),
    );

    // Wing fold on landing: spread → fold → slight bounce → settled
    scX.value = withDelay(
      DELAY + 540,
      withSequence(
        withTiming(0.32, { duration: 170, easing: Easing.in(Easing.ease) }),
        withTiming(1.2, { duration: 110 }),
        withTiming(0.75, { duration: 120 }),
      ),
    );

    // Dissolve before badge appears
    op.value = withDelay(2230, withTiming(0, { duration: 160 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    opacity: op.value,
    transform: [
      { rotate: `${rot.value}deg` },
      { scaleX: scX.value },
      { scaleY: scY.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Svg width={80} height={64} viewBox="-40 -32 80 64">
        <Path d={BIG_BIRD_PATH} fill={rarityColor} />
      </Svg>
    </Animated.View>
  );
}

// ─── Badge reveal ─────────────────────────────────────────────────────────────
interface BadgeRevealProps {
  result: IdentificationResult;
  rarityColor: string;
}

function BadgeReveal({ result, rarityColor }: BadgeRevealProps) {
  const { bird } = result;

  const badgeSc = useSharedValue(0);
  const badgeOp = useSharedValue(0);
  const glowSc = useSharedValue(1);
  const glowOp = useSharedValue(0);
  const headlineOp = useSharedValue(0);
  const headlineY = useSharedValue(28);
  const nameOp = useSharedValue(0);
  const nameY = useSharedValue(18);

  const DELAY = 2340;

  useEffect(() => {
    // Badge spring-in
    badgeSc.value = withDelay(DELAY, withSpring(1, { damping: 5, stiffness: 200 }));
    badgeOp.value = withDelay(DELAY, withTiming(1, { duration: 180 }));

    // Glow ring pulses × 3
    glowOp.value = withDelay(
      DELAY + 120,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 340, easing: Easing.out(Easing.ease) }),
          withTiming(0.1, { duration: 340, easing: Easing.in(Easing.ease) }),
        ),
        3,
      ),
    );
    glowSc.value = withDelay(
      DELAY + 120,
      withRepeat(
        withSequence(
          withTiming(1.7, { duration: 340, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 340, easing: Easing.in(Easing.ease) }),
        ),
        3,
      ),
    );

    // Headline text
    headlineOp.value = withDelay(DELAY + 520, withTiming(1, { duration: 380 }));
    headlineY.value = withDelay(DELAY + 520, withSpring(0, { damping: 12, stiffness: 140 }));

    // Bird name
    nameOp.value = withDelay(DELAY + 740, withTiming(1, { duration: 380 }));
    nameY.value = withDelay(DELAY + 740, withSpring(0, { damping: 12, stiffness: 140 }));
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeSc.value }],
    opacity: badgeOp.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowSc.value }],
    opacity: glowOp.value,
  }));

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOp.value,
    transform: [{ translateY: headlineY.value }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOp.value,
    transform: [{ translateY: nameY.value }],
  }));

  return (
    <View style={styles.badgeContainer} pointerEvents="none">
      {/* Glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          { borderColor: rarityColor },
          glowStyle,
        ]}
      />

      {/* Badge circle */}
      <Animated.View
        style={[
          styles.badgeCircle,
          { backgroundColor: rarityColor + '22', borderColor: rarityColor },
          badgeStyle,
        ]}
      >
        {result.photoUrl ? (
          <Image source={{ uri: result.photoUrl }} style={styles.badgePhoto} />
        ) : bird.thumbnailUrl ? (
          <Image source={{ uri: bird.thumbnailUrl }} style={styles.badgePhoto} />
        ) : (
          <Text style={styles.badgeEmoji}>🐦</Text>
        )}
        <View style={[styles.badgeRarityStrip, { backgroundColor: rarityColor }]}>
          <Text style={styles.badgeRarityText}>{bird.rarity.toUpperCase()}</Text>
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.Text style={[styles.headline, headlineStyle]}>
        ✨ New Species Discovered!
      </Animated.Text>

      <Animated.View style={[styles.nameRow, nameStyle]}>
        <Text style={styles.birdName}>{bird.commonName}</Text>
        <Text style={styles.birdScientific}>{bird.scientificName}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
interface Props {
  result: IdentificationResult;
  onDismiss: () => void;
}

export default function CatchAnimation({ result, onDismiss }: Props) {
  const overlayOp = useSharedValue(0);
  const rarityColor = rarityColors[result.bird.rarity];

  // Pre-generate chaos bird configs (stable across renders)
  const birdConfigs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const { x, y } = randomEdge();
        return {
          id: i,
          startX: x,
          startY: y,
          delay: 80 + i * 70 + Math.random() * 60,
          scale: 0.55 + Math.random() * 0.55,
          initRot: Math.random() * 360 - 180,
        };
      }),
    [],
  );

  useEffect(() => {
    // Overlay fade-in
    overlayOp.value = withTiming(1, { duration: 220 });

    // Haptic sequence: three thumps then a success
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 320);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 640);
    setTimeout(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      2400,
    );

    return () => {
      cancelAnimation(overlayOp);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          {/* Blurred background photo */}
          {result.photoUrl ? (
            <Image
              source={{ uri: result.photoUrl }}
              style={[StyleSheet.absoluteFill, { opacity: 0.18 }]}
              blurRadius={22}
            />
          ) : null}

          {/* Chaos birds */}
          {birdConfigs.map((cfg) => (
            <ChaosBird key={cfg.id} {...cfg} />
          ))}

          {/* Landing bird */}
          <LandingBird rarityColor={rarityColor} />

          {/* Badge + text reveal */}
          <BadgeReveal result={result} rarityColor={rarityColor} />

          {/* Dismiss hint */}
          <Text style={styles.tapToDismiss}>Tap anywhere to continue</Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const BADGE_SIZE = 160;
const GLOW_SIZE = BADGE_SIZE * 1.8;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,12,20,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Badge ──────────────────────────────────────────────────
  badgeContainer: {
    position: 'absolute',
    alignItems: 'center',
    top: CY - BADGE_SIZE * 0.9,
  },
  glowRing: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    borderWidth: 3,
    top: (BADGE_SIZE - GLOW_SIZE) / 2,
  },
  badgeCircle: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: BADGE_SIZE / 2,
  },
  badgeEmoji: {
    fontSize: 72,
  },
  badgeRarityStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: 'center',
  },
  badgeRarityText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.85)',
    letterSpacing: 1.2,
  },

  // ── Text ───────────────────────────────────────────────────
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
    marginTop: BADGE_SIZE + 16,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  nameRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  birdName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  birdScientific: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 3,
    textAlign: 'center',
  },

  tapToDismiss: {
    position: 'absolute',
    bottom: 52,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
});
