import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { Player, PlayerStep } from '../lib/types';
import { Match } from '../lib/types';

interface PlayerHeroCardProps {
  players: Player[];
  matches: Match[];
  // playerId → 現在の所属チーム名（最新のステップから取得済み）
  currentTeams: Record<string, string | null>;
}

export function PlayerHeroCard({ players, matches, currentTeams }: PlayerHeroCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (players.length === 0) return null;

  const player = players[activeIndex];

  // 今年度の戦績を集計
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  // サッカーは4月始まりの年度で考える
  const seasonStart = currentMonth >= 3
    ? new Date(currentYear, 3, 1)      // 今年4月〜
    : new Date(currentYear - 1, 3, 1); // 昨年4月〜

  const seasonMatches = matches.filter((m) => m.date.toDate() >= seasonStart && m.result != null);
  const wins = seasonMatches.filter((m) => m.result === 'win').length;
  const draws = seasonMatches.filter((m) => m.result === 'draw').length;
  const losses = seasonMatches.filter((m) => m.result === 'loss').length;
  const total = seasonMatches.length;

  const currentTeam = currentTeams[player.id];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/player/${player.id}`)}
    >
      <View style={styles.inner}>
        {/* 顔写真 */}
        {player.photoUrl ? (
          <Image source={{ uri: player.photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="person" size={28} color={theme.textSecondary} />
          </View>
        )}

        {/* 情報 */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
          {player.number != null && (
            <Text style={styles.number}>#{player.number}</Text>
          )}
          {currentTeam ? (
            <View style={styles.teamRow}>
              <Ionicons name="football-outline" size={12} color={theme.primary} />
              <Text style={styles.teamName} numberOfLines={1}>{currentTeam}</Text>
            </View>
          ) : null}

          {/* 今年度戦績 */}
          {total > 0 ? (
            <View style={styles.statsRow}>
              <View style={[styles.statBadge, { backgroundColor: theme.win }]}>
                <Text style={styles.statText}>{wins}勝</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: theme.draw }]}>
                <Text style={styles.statText}>{draws}分</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: theme.loss }]}>
                <Text style={styles.statText}>{losses}敗</Text>
              </View>
              <Text style={styles.statTotal}>{total}試合</Text>
            </View>
          ) : (
            <Text style={styles.noStats}>今年度の試合なし</Text>
          )}
        </View>

        {/* 切り替えボタン（複数選手の場合） */}
        {players.length > 1 && (
          <View style={styles.switchArea}>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev - 1 + players.length) % players.length);
              }}
            >
              <Ionicons name="chevron-back" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.switchIndex}>{activeIndex + 1}/{players.length}</Text>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev + 1) % players.length);
              }}
            >
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 選手インジケータードット */}
      {players.length > 1 && (
        <View style={styles.dots}>
          {players.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: theme.text,
  },
  number: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  teamName: {
    fontSize: fontSize.xs,
    color: theme.primary,
    fontWeight: '600',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  statBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  statText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.white,
  },
  statTotal: {
    fontSize: 10,
    color: theme.textSecondary,
  },
  noStats: {
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 3,
  },
  switchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  switchBtn: {
    padding: spacing.xs,
  },
  switchIndex: {
    fontSize: 10,
    color: theme.textSecondary,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingBottom: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.border,
  },
  dotActive: {
    backgroundColor: theme.primary,
    width: 12,
  },
});
