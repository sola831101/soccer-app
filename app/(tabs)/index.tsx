import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { MatchCard } from '../../components/MatchCard';
import { EmptyState } from '../../components/EmptyState';
import { AdBanner } from '../../components/AdBanner';

export default function HomeScreen() {
  const { team, upcomingMatches, recentResults } = useTeam();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.teamName}>{team?.name || 'チーム'}</Text>
            <Text style={styles.headerSub}>試合スケジュール</Text>
          </View>
          <Ionicons name="football" size={32} color={theme.primary} />
        </View>

        {/* 次の試合 */}
        <Text style={styles.sectionTitle}>試合の予定</Text>
        {upcomingMatches.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="予定なし"
            message="右下の＋ボタンから試合を登録しましょう"
          />
        ) : (
          upcomingMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        )}

        <AdBanner />

        {/* 最近の結果 */}
        {recentResults.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>最近の結果</Text>
            {recentResults.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onPress={() => router.push(`/match/${match.id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* FAB */}
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  teamName: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: theme.text,
  },
  headerSub: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
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
