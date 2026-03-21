import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { Match } from '../lib/types';
import { MatchTypeBadge } from './MatchTypeBadge';
import { ScoreDisplay } from './ScoreDisplay';

interface Props {
  match: Match;
  onPress: () => void;
}

function formatDate(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${m}/${d}(${day}) ${h}:${min}`;
}

export function MatchCard({ match, onPress }: Props) {
  const date = match.date.toDate();
  const hasScore = match.scoreHome != null && match.scoreAway != null;
  const now = new Date();
  const needsResult = date < now && !hasScore;

  return (
    <TouchableOpacity
      style={[styles.card, needsResult && styles.cardNeedsResult]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MatchTypeBadge type={match.matchType} competitionName={match.competitionName} />
          {needsResult && (
            <View style={styles.needsResultBadge}>
              <Ionicons name="alert-circle" size={12} color={theme.warning} />
              <Text style={styles.needsResultText}>結果未入力</Text>
            </View>
          )}
        </View>
        <Text style={styles.date}>{formatDate(date)}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.opponentRow}>
          <Text style={styles.vs}>vs</Text>
          <Text style={styles.opponent}>{match.opponent}</Text>
        </View>

        {hasScore && (
          <ScoreDisplay
            scoreHome={match.scoreHome}
            scoreAway={match.scoreAway}
            result={match.result}
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.venueRow}>
          <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.venue}>{match.venue}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardNeedsResult: {
    borderColor: theme.warning,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  needsResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  needsResultText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.warning,
  },
  date: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vs: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginRight: spacing.sm,
    fontWeight: '500',
  },
  opponent: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venue: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
  },
});
