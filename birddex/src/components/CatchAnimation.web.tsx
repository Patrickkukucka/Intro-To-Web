import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { IdentificationResult } from '../types';
import { rarityColors } from '../theme';

interface Props {
  result: IdentificationResult;
  onDismiss: () => void;
}

export default function CatchAnimation({ result, onDismiss }: Props) {
  const { bird } = result;
  const rarityColor = rarityColors[bird.rarity];

  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <View style={styles.overlay}>
      <View style={[styles.badge, { borderColor: rarityColor }]}>
        <Text style={styles.emoji}>🐦</Text>
        <Text style={[styles.rarity, { color: rarityColor }]}>
          {bird.rarity.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.headline}>✨ New Species Discovered!</Text>
      <Text style={styles.name}>{bird.commonName}</Text>
      <Text style={styles.scientific}>{bird.scientificName}</Text>
      <Text style={styles.dismiss} onPress={onDismiss}>
        Tap to continue
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,12,20,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  badge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: { fontSize: 60 },
  rarity: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  scientific: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  dismiss: {
    marginTop: 40,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
});
