import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { MatchCard } from '../../components/MatchCard';
import { EmptyState } from '../../components/EmptyState';
import { AdBanner } from '../../components/AdBanner';
import { PlayerHeroCard } from '../../components/PlayerHeroCard';
import { subscribeToPlayerSteps } from '../../lib/firestore';
import { PlayerStep } from '../../lib/types';

export default function HomeScreen() {
  const { teamId, players, matches, upcomingMatches, recentResults, loading } = useTeam();

  // playerId → 最新ステップ（現在の所属チーム取得用）
  const [stepsMap, setStepsMap] = useState<Record<string, PlayerStep[]>>({});

  useEffect(() => {
    if (!teamId || players.length === 0) {
      setStepsMap({});
      return;
    }

    const unsubs = players.map((player) =>
      subscribeToPlayerSteps(teamId, player.id, (steps) => {
        setStepsMap((prev) => ({ ...prev, [player.id]: steps }));
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [teamId, players]);

  // playerId → 現在の所属チーム名（endDateなし = 在籍中を優先、なければ最新）
  const currentTeams: Record<string, string | null> = {};
  for (const player of players) {
    const steps = stepsMap[player.id] ?? [];
    const current = steps.find((s) => !s.endDate) ?? steps[0] ?? null;
    currentTeams[player.id] = current?.teamName ?? null;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 選手カード */}
        {players.length > 0 && (
          <PlayerHeroCard
            players={players}
            matches={matches}
            currentTeams={currentTeams}
          />
        )}

        <AdBanner />

        {/* 次の試合 */}
        <Text style={styles.sectionTitle}>試合の予定</Text>
        {!loading && upcomingMatches.length === 0 ? (
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
              players={players}
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
                players={players}
                onPress={() => router.push(`/match/${match.id}`)}
              />
            ))}
            <AdBanner />
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
