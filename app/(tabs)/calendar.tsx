import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { MatchCard } from '../../components/MatchCard';
import { EmptyState } from '../../components/EmptyState';
import { AdBanner } from '../../components/AdBanner';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function CalendarScreen() {
  const { matches } = useTeam();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  // 表示月の試合（昇順）
  const monthMatches = useMemo(() => {
    return matches
      .filter((m) => {
        const d = m.date.toDate();
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
  }, [matches, year, month]);

  // 「今後の試合予定」見出しを入れる最初の試合（今より先＝これからの試合）
  const firstUpcomingId = useMemo(() => {
    const nowTime = Date.now();
    const m = monthMatches.find((mm) => mm.date.toDate().getTime() >= nowTime);
    return m?.id ?? null;
  }, [monthMatches]);

  // 表示月のサマリー（結果が入っている試合のみ勝敗を集計）
  const summary = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let withScore = 0;
    for (const m of monthMatches) {
      if (m.scoreHome != null && m.scoreAway != null) {
        withScore++;
        if (m.result === 'win') wins++;
        else if (m.result === 'loss') losses++;
        else if (m.result === 'draw') draws++;
      }
    }
    return { total: monthMatches.length, wins, losses, draws, withScore };
  }, [monthMatches]);

  const goPrevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const goThisMonth = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <View style={styles.container}>
      {/* 月スライダー（上部固定） */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={goPrevMonth} style={styles.arrowBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goThisMonth} activeOpacity={0.7} style={styles.monthLabelWrap}>
          <Text style={styles.monthLabel}>
            {year}年 {month + 1}月
          </Text>
          {summary.total > 0 ? (
            <Text style={styles.monthSummary}>
              {summary.total}試合
              {summary.withScore > 0 ? `　${summary.wins}勝 ${summary.draws}分 ${summary.losses}敗` : ''}
            </Text>
          ) : (
            <Text style={styles.monthSummary}>試合なし</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={goNextMonth} style={styles.arrowBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {!isThisMonth && (
        <TouchableOpacity onPress={goThisMonth} style={styles.todayChip} activeOpacity={0.7}>
          <Ionicons name="today-outline" size={14} color={theme.primary} />
          <Text style={styles.todayChipText}>今月に戻る</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {monthMatches.length === 0 ? (
          <EmptyState
            icon="football-outline"
            title="試合なし"
            message="この月に試合はありません"
          />
        ) : (
          monthMatches.map((match) => {
            const d = match.date.toDate();
            const wd = d.getDay();
            const wdColor =
              wd === 0 ? theme.loss : wd === 6 ? theme.officialBadge : theme.text;
            return (
              <React.Fragment key={match.id}>
                {match.id === firstUpcomingId && (
                  <View style={styles.divider}>
                    <Ionicons name="time-outline" size={16} color={theme.primary} />
                    <Text style={styles.dividerText}>今後の試合予定</Text>
                  </View>
                )}
                <View style={styles.agendaRow}>
                  <View style={styles.dateRail}>
                    <Text style={[styles.dateDay, { color: wdColor }]}>{d.getDate()}</Text>
                    <Text style={[styles.dateWd, { color: wdColor }]}>{WEEKDAYS[wd]}</Text>
                  </View>
                  <View style={styles.cardWrap}>
                    <MatchCard
                      match={match}
                      dateFormat="time"
                      onPress={() => router.push(`/match/${match.id}`)}
                    />
                  </View>
                </View>
              </React.Fragment>
            );
          })
        )}

        <AdBanner />
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FAB（試合登録） */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/match/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={theme.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: theme.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.surface,
  },
  monthLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: theme.text,
  },
  monthSummary: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: theme.border,
    borderRadius: borderRadius.full,
  },
  todayChipText: {
    fontSize: fontSize.xs,
    color: theme.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dividerText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.primary,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateRail: {
    width: 40,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  dateDay: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  dateWd: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  cardWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
