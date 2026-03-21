import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, fontSize, borderRadius, spacing } from '../constants/theme';
import { MatchType } from '../lib/types';

interface Props {
  type: MatchType;
  competitionName?: string;
}

export function MatchTypeBadge({ type, competitionName }: Props) {
  const isOfficial = type === 'official';
  const label = isOfficial
    ? competitionName || '公式戦'
    : '練習試合';
  const bgColor = isOfficial ? theme.officialBadge : theme.practiceBadge;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    color: theme.white,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
