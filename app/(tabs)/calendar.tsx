import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { router } from 'expo-router';
import { theme, fontSize, spacing } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { MatchCard } from '../../components/MatchCard';
import { EmptyState } from '../../components/EmptyState';
import { AdBanner } from '../../components/AdBanner';

// 日本語ロケール設定
LocaleConfig.locales['ja'] = {
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
  today: '今日',
};
LocaleConfig.defaultLocale = 'ja';

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

export default function CalendarScreen() {
  const { matches } = useTeam();
  const [selectedDate, setSelectedDate] = useState('');
  const [currentMonth, setCurrentMonth] = useState(getCurrentYearMonth);

  const markedDates = useMemo(() => {
    const marks: Record<string, {
      dots: { key: string; color: string }[];
      selected?: boolean;
      selectedColor?: string;
      selectedTextColor?: string;
    }> = {};

    for (const match of matches) {
      const dateStr = match.date.toDate().toISOString().split('T')[0];
      const dotColor = match.matchType === 'official' ? theme.officialBadge : theme.practiceBadge;

      if (!marks[dateStr]) {
        marks[dateStr] = { dots: [] };
      }
      marks[dateStr].dots.push({
        key: match.id,
        color: dotColor,
      });
    }

    // 試合がある日に薄い丸背景をつける
    for (const dateStr of Object.keys(marks)) {
      marks[dateStr] = {
        ...marks[dateStr],
        selected: true,
        selectedColor: '#E8F5E9',
        selectedTextColor: theme.text,
      };
    }

    // ユーザーがタップした日は濃い緑で上書き
    if (selectedDate) {
      if (marks[selectedDate]) {
        marks[selectedDate] = {
          ...marks[selectedDate],
          selected: true,
          selectedColor: theme.primary,
          selectedTextColor: theme.white,
        };
      } else {
        marks[selectedDate] = {
          dots: [],
          selected: true,
          selectedColor: theme.primary,
          selectedTextColor: theme.white,
        };
      }
    }

    return marks;
  }, [matches, selectedDate]);

  // 日付選択時: その日の試合、未選択時: 表示月の試合
  const filteredMatches = useMemo(() => {
    if (selectedDate) {
      return matches.filter((m) => {
        const dateStr = m.date.toDate().toISOString().split('T')[0];
        return dateStr === selectedDate;
      });
    }
    return matches
      .filter((m) => {
        const d = m.date.toDate();
        const y = d.getFullYear();
        const mo = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${y}-${mo}` === currentMonth;
      })
      .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
  }, [matches, selectedDate, currentMonth]);

  const monthLabel = parseInt(currentMonth.split('-')[1], 10);

  return (
    <ScrollView style={styles.container}>
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={(day: { dateString: string }) => {
          setSelectedDate(day.dateString === selectedDate ? '' : day.dateString);
        }}
        onMonthChange={(month: { year: number; month: number }) => {
          const y = month.year;
          const m = month.month.toString().padStart(2, '0');
          setCurrentMonth(`${y}-${m}`);
          setSelectedDate('');
        }}
        theme={{
          backgroundColor: theme.background,
          calendarBackground: theme.background,
          todayTextColor: theme.primary,
          arrowColor: theme.primary,
          selectedDayBackgroundColor: theme.primary,
          selectedDayTextColor: theme.white,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textMonthFontSize: fontSize.lg,
        }}
        firstDay={0}
      />

      <AdBanner />

      <View style={styles.matchList}>
        <Text style={styles.sectionTitle}>
          {selectedDate
            ? `${selectedDate.replace(/-/g, '/')} の試合`
            : `${monthLabel}月の試合`}
        </Text>

        {filteredMatches.length === 0 ? (
          <EmptyState
            icon="football-outline"
            title="試合なし"
            message={selectedDate ? 'この日に試合はありません' : 'この月に試合はありません'}
          />
        ) : (
          filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  matchList: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
  },
});
