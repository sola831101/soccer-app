import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, fontSize, spacing } from '../constants/theme';
import { MatchResult } from '../lib/types';

interface Props {
  scoreHome: number | null;
  scoreAway: number | null;
  result?: MatchResult | null;
  size?: 'small' | 'large';
}

const resultLabel: Record<string, string> = {
  win: '勝ち',
  loss: '負け',
  draw: '引分',
};

const resultColor: Record<string, string> = {
  win: theme.win,
  loss: theme.loss,
  draw: theme.draw,
};

export function ScoreDisplay({ scoreHome, scoreAway, result, size = 'small' }: Props) {
  if (scoreHome == null || scoreAway == null) {
    return (
      <Text style={[styles.pending, size === 'large' && styles.pendingLarge]}>
        - : -
      </Text>
    );
  }

  const isLarge = size === 'large';

  return (
    <View style={styles.container}>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, isLarge && styles.scoreLarge]}>
          {scoreHome}
        </Text>
        <Text style={[styles.separator, isLarge && styles.separatorLarge]}>
          -
        </Text>
        <Text style={[styles.score, isLarge && styles.scoreLarge]}>
          {scoreAway}
        </Text>
      </View>
      {result && (
        <Text style={[styles.result, { color: resultColor[result] }]}>
          {resultLabel[result]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  score: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
    minWidth: 24,
    textAlign: 'center',
  },
  scoreLarge: {
    fontSize: 48,
    minWidth: 60,
  },
  separator: {
    fontSize: fontSize.lg,
    color: theme.textSecondary,
    marginHorizontal: spacing.xs,
  },
  separatorLarge: {
    fontSize: 36,
    marginHorizontal: spacing.md,
  },
  pending: {
    fontSize: fontSize.lg,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  pendingLarge: {
    fontSize: 48,
  },
  result: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
