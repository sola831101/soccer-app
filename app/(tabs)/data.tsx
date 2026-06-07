import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { computeStats, computeOpponentStats, getAvailableFiscalYears, computePlayerStatLines, getFiscalYear } from '../../lib/stats';
import { AdBanner } from '../../components/AdBanner';

export default function DataScreen() {
  const { matches, players, hasFeature } = useTeam();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [showAllOpponents, setShowAllOpponents] = useState(false);

  const fiscalYears = useMemo(() => getAvailableFiscalYears(matches), [matches]);

  // 初期表示は「全期間」ではなく現在の年度をデフォルトに（データがあれば）。
  // 現年度に試合が無ければ最新の年度へフォールバック。ユーザーが触った後は上書きしない。
  const didInitYear = useRef(false);
  useEffect(() => {
    if (didInitYear.current) return;
    if (matches.length === 0) return; // データ読み込み待ち
    didInitYear.current = true;
    const current = getFiscalYear(new Date());
    if (fiscalYears.includes(current)) {
      setSelectedYear(current);
    } else if (fiscalYears.length > 0) {
      setSelectedYear(fiscalYears[0]);
    }
  }, [matches, fiscalYears]);

  // 選手フィルター：選択中の選手が出場した試合のみ
  const filteredMatches = useMemo(() => {
    if (!selectedPlayerId) return matches;
    return matches.filter((m) => (m.playerIds ?? []).includes(selectedPlayerId));
  }, [matches, selectedPlayerId]);

  const stats = useMemo(() => computeStats(filteredMatches, selectedYear), [filteredMatches, selectedYear]);
  const opponentStats = useMemo(() => computeOpponentStats(filteredMatches, selectedYear), [filteredMatches, selectedYear]);

  // 選手成績ランキング（ファミリープラン）。選手フィルター中は全員集計のままにする
  const canUsePlayerStats = hasFeature('playerStats');
  const playerLines = useMemo(
    () => computePlayerStatLines(matches, players, selectedYear),
    [matches, players, selectedYear]
  );
  const hasAnyPlayerStat = playerLines.some((l) => l.goals > 0 || l.assists > 0 || l.clears > 0);

  const completedCount = filteredMatches.filter((m) => m.status === 'completed').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 選手フィルター（選手が2人以上の場合のみ） */}
      {players.length >= 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearSelector}>
          <TouchableOpacity
            style={[styles.yearPill, selectedPlayerId === undefined && styles.playerPillActive]}
            onPress={() => setSelectedPlayerId(undefined)}
          >
            <Text style={[styles.yearPillText, selectedPlayerId === undefined && styles.playerPillTextActive]}>
              全員
            </Text>
          </TouchableOpacity>
          {players.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.yearPill, selectedPlayerId === p.id && styles.playerPillActive]}
              onPress={() => setSelectedPlayerId(p.id)}
            >
              <Text style={[styles.yearPillText, selectedPlayerId === p.id && styles.playerPillTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 年度セレクタ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearSelector}>
        <TouchableOpacity
          style={[styles.yearPill, selectedYear === undefined && styles.yearPillActive]}
          onPress={() => setSelectedYear(undefined)}
        >
          <Text style={[styles.yearPillText, selectedYear === undefined && styles.yearPillTextActive]}>
            全期間
          </Text>
        </TouchableOpacity>
        {fiscalYears.map((year) => (
          <TouchableOpacity
            key={year}
            style={[styles.yearPill, selectedYear === year && styles.yearPillActive]}
            onPress={() => setSelectedYear(year)}
          >
            <Text style={[styles.yearPillText, selectedYear === year && styles.yearPillTextActive]}>
              {year}年度
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {completedCount === 0 ? (
        /* データなし */
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={64} color={theme.border} />
          <Text style={styles.emptyText}>まだ試合結果がありません</Text>
          <Text style={styles.emptySubText}>試合を登録して結果を入力すると{'\n'}ここに成績が表示されます</Text>
        </View>
      ) : stats.totalMatches === 0 ? (
        /* 選択年度にデータなし */
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={theme.border} />
          <Text style={styles.emptyText}>この年度の試合結果はありません</Text>
        </View>
      ) : (
        <>
          {/* フィルターラベル */}
          {(selectedPlayerId || selectedYear) && (
            <View style={styles.filterLabel}>
              <Ionicons name="filter-outline" size={14} color={theme.primary} />
              <Text style={styles.filterLabelText}>
                {[
                  selectedPlayerId ? players.find((p) => p.id === selectedPlayerId)?.name : null,
                  selectedYear ? `${selectedYear}年度` : null,
                ].filter(Boolean).join(' / ')}
              </Text>
              <TouchableOpacity onPress={() => { setSelectedPlayerId(undefined); setSelectedYear(undefined); }}>
                <Text style={styles.filterClear}>クリア</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 戦績カード */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>戦績</Text>
            <View style={styles.recordRow}>
              <View style={styles.recordItem}>
                <Text style={[styles.recordNumber, { color: theme.win }]}>{stats.wins}</Text>
                <Text style={styles.recordLabel}>勝</Text>
              </View>
              <View style={styles.recordItem}>
                <Text style={[styles.recordNumber, { color: theme.loss }]}>{stats.losses}</Text>
                <Text style={styles.recordLabel}>敗</Text>
              </View>
              <View style={styles.recordItem}>
                <Text style={[styles.recordNumber, { color: theme.draw }]}>{stats.draws}</Text>
                <Text style={styles.recordLabel}>分</Text>
              </View>
            </View>
            <View style={styles.subRow}>
              <Text style={styles.subText}>勝率 {stats.winRate}%</Text>
              <Text style={styles.subText}>全{stats.totalMatches}試合</Text>
            </View>
          </View>

          {/* 得失点カード */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>得失点</Text>
            <View style={styles.goalRow}>
              <View style={styles.goalItem}>
                <Text style={styles.goalNumber}>{stats.goalsScored}</Text>
                <Text style={styles.goalLabel}>得点</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalNumber}>{stats.goalsConceded}</Text>
                <Text style={styles.goalLabel}>失点</Text>
              </View>
              <View style={styles.goalItem}>
                <Text
                  style={[
                    styles.goalNumber,
                    {
                      color:
                        stats.goalDifference > 0
                          ? theme.win
                          : stats.goalDifference < 0
                          ? theme.loss
                          : theme.draw,
                    },
                  ]}
                >
                  {stats.goalDifference > 0 ? '+' : ''}
                  {stats.goalDifference}
                </Text>
                <Text style={styles.goalLabel}>得失点差</Text>
              </View>
            </View>
          </View>

          <AdBanner />

          {/* 内訳カード */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>内訳</Text>

            {/* 公式戦 */}
            {stats.officialMatches > 0 && (
              <View style={styles.breakdownSection}>
                <View style={styles.breakdownHeader}>
                  <View style={[styles.badge, { backgroundColor: theme.officialBadge }]}>
                    <Text style={styles.badgeText}>公式戦</Text>
                  </View>
                  <Text style={styles.breakdownCount}>{stats.officialMatches}試合</Text>
                </View>
                <Text style={styles.breakdownDetail}>
                  {stats.officialWins}勝 {stats.officialLosses}敗 {stats.officialDraws}分{'  '}|{'  '}
                  得点 {stats.officialGoalsScored} - 失点 {stats.officialGoalsConceded}
                </Text>
              </View>
            )}

            {/* 練習試合 */}
            {stats.practiceMatches > 0 && (
              <View style={styles.breakdownSection}>
                <View style={styles.breakdownHeader}>
                  <View style={[styles.badge, { backgroundColor: theme.practiceBadge }]}>
                    <Text style={styles.badgeText}>練習試合</Text>
                  </View>
                  <Text style={styles.breakdownCount}>{stats.practiceMatches}試合</Text>
                </View>
                <Text style={styles.breakdownDetail}>
                  {stats.practiceWins}勝 {stats.practiceLosses}敗 {stats.practiceDraws}分{'  '}|{'  '}
                  得点 {stats.practiceGoalsScored} - 失点 {stats.practiceGoalsConceded}
                </Text>
              </View>
            )}
          </View>

          {/* 対戦チーム別成績 */}
          {opponentStats.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>対戦チーム別</Text>
              {(showAllOpponents ? opponentStats : opponentStats.slice(0, 5)).map((rec, idx, arr) => (
                <View
                  key={rec.opponent}
                  style={[
                    styles.opponentRow,
                    idx < arr.length - 1 && styles.opponentBorder,
                  ]}
                >
                  <Text style={styles.opponentName}>{rec.opponent}</Text>
                  <View style={styles.opponentDetail}>
                    <View style={styles.opponentRecord}>
                      <Text style={[styles.opponentWLD, { color: theme.win }]}>{rec.wins}勝</Text>
                      <Text style={[styles.opponentWLD, { color: theme.loss }]}>{rec.losses}敗</Text>
                      <Text style={[styles.opponentWLD, { color: theme.draw }]}>{rec.draws}分</Text>
                    </View>
                    <Text style={styles.opponentGoals}>
                      {rec.goalsScored}-{rec.goalsConceded}
                    </Text>
                  </View>
                </View>
              ))}
              {opponentStats.length > 5 && (
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => setShowAllOpponents((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreButtonText}>
                    {showAllOpponents ? '閉じる' : `もっと見る（全${opponentStats.length}チーム）`}
                  </Text>
                  <Ionicons
                    name={showAllOpponents ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 選手成績ランキング（ファミリープラン） */}
          {canUsePlayerStats && players.length > 0 && hasAnyPlayerStat && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>選手成績</Text>
              {playerLines
                .filter((l) => l.goals > 0 || l.assists > 0 || l.matches > 0)
                .map((line, idx, arr) => (
                  <View
                    key={line.playerId}
                    style={[
                      styles.playerStatRow,
                      idx < arr.length - 1 && styles.opponentBorder,
                    ]}
                  >
                    <View
                      style={[
                        styles.playerStatRank,
                        idx === 0 && { backgroundColor: '#FFD700' },
                        idx === 1 && { backgroundColor: '#C0C0C0' },
                        idx === 2 && { backgroundColor: '#CD7F32' },
                      ]}
                    >
                      <Text
                        style={[styles.playerStatRankText, idx <= 2 && { color: theme.white }]}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={styles.playerStatInfo}>
                      <Text style={styles.playerStatName} numberOfLines={1}>
                        {line.number != null ? `#${line.number} ` : ''}{line.name}
                      </Text>
                      <Text style={styles.playerStatSub}>{line.matches}試合出場</Text>
                    </View>
                    <View style={styles.playerStatNums}>
                      <View style={styles.playerStatNumItem}>
                        <Text style={[styles.playerStatNum, { color: theme.officialBadge }]}>{line.goals}</Text>
                        <Text style={styles.playerStatNumLabel}>得点</Text>
                      </View>
                      <View style={styles.playerStatNumItem}>
                        <Text style={[styles.playerStatNum, { color: '#8E24AA' }]}>{line.assists}</Text>
                        <Text style={styles.playerStatNumLabel}>アシスト</Text>
                      </View>
                      <View style={styles.playerStatNumItem}>
                        <Text style={[styles.playerStatNum, { color: '#00897B' }]}>{line.clears}</Text>
                        <Text style={styles.playerStatNumLabel}>ブロック</Text>
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: spacing.md,
  },
  yearSelector: {
    marginBottom: spacing.md,
    flexGrow: 0,
  },
  yearPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: spacing.sm,
    backgroundColor: theme.white,
  },
  yearPillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  yearPillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  yearPillTextActive: {
    color: theme.white,
  },
  playerPillActive: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  playerPillTextActive: {
    color: theme.white,
  },
  card: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.md,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  recordItem: {
    alignItems: 'center',
  },
  recordNumber: {
    fontSize: 40,
    fontWeight: '800',
  },
  recordLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  subText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  goalItem: {
    alignItems: 'center',
  },
  goalNumber: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: theme.text,
  },
  goalLabel: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  breakdownSection: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.white,
  },
  breakdownCount: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  breakdownDetail: {
    fontSize: fontSize.sm,
    color: theme.text,
    marginTop: spacing.xs,
  },
  filterLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#E3F2FD',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  filterLabelText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#1565C0',
  },
  filterClear: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: spacing.md,
  },
  emptySubText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  opponentRow: {
    paddingVertical: spacing.sm,
  },
  opponentBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  moreButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.primary,
  },
  opponentName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  opponentDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opponentRecord: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  opponentWLD: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  opponentGoals: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  playerStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  playerStatRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  playerStatRankText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: theme.textSecondary,
  },
  playerStatInfo: {
    flex: 1,
  },
  playerStatName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
  },
  playerStatSub: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },
  playerStatNums: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playerStatNumItem: {
    alignItems: 'center',
    minWidth: 38,
  },
  playerStatNum: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  playerStatNumLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
});
