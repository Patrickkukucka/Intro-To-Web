import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography, rarityColors } from '../theme';
import { Rarity } from '../types';

const RARITY_ICONS: Record<Rarity, string> = {
  Common: '●',
  Uncommon: '◆',
  Rare: '★',
  Legendary: '✦',
};

interface Props {
  rarity: Rarity;
  small?: boolean;
}

export default function RarityBadge({ rarity, small = false }: Props) {
  const color = rarityColors[rarity];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + '22', borderColor: color + '66' },
        small && styles.badgeSmall,
      ]}
    >
      <Text style={[styles.icon, { color }, small && styles.iconSmall]}>
        {RARITY_ICONS[rarity]}
      </Text>
      <Text style={[styles.text, { color }, small && styles.textSmall]}>
        {rarity}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  icon: { fontSize: 10 },
  iconSmall: { fontSize: 8 },
  text: { ...typography.captionBold, fontSize: 11 },
  textSmall: { fontSize: 9 },
});
