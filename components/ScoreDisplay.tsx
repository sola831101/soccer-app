import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, fontSize, spacing } from '../constants/theme';
import { MatchResult } from '../lib/types';

interface Props {
  scoreHome: number | null;
  scoreAway: number | null;
  result?: MatchResult | null;
  etHome?: number | null;
  etAway?: number | null;
  pkHome?: number | null;
  pkAway?: number | null;
  noResult?: boolean;
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

export function ScoreDisplay({
  scoreHome, scoreAway, result,
  etHome, etAway, pkHome, pkAway, noResult,
  size = 'small',
}: Props) {
  const isLarge = size === 'large';

  // 勝敗を記録しない試合
  if (noResult) {
    return (
      <Text style={[styles.pending, isLarge && styles.pendingLarge]}>記録なし</Text>
    );
  }

  if (scoreHome == null || scoreAway == null) {
    return (
      <Text style={[styles.pending, isLarge && styles.pendingLarge]}>
        - : -
      </Text>
    );
  }

  // 延長・PKの補足行
  const extras: string[] = [];
  if (etHome != null && etAway != null) extras.push(`延長 ${etHome}-${etAway}`);
  if (pkHome != null && pkAway != null) extras.push(`PK ${pkHome}-${pkAway}`);

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
      {extras.length > 0 && (
        <Text style={styles.extra}>{extras.join(' ／ ')}</Text>
      )}
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
  extra: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
});
