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
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { MatchCard } from '../../components/MatchCard';
import { EmptyState } from '../../components/EmptyState';
import { AdBanner } from '../../components/AdBanner';
import { PlayerHeroCard } from '../../components/PlayerHeroCard';
import { UpgradeModal } from '../../components/UpgradeModal';
import { subscribeToPlayerSteps } from '../../lib/firestore';
import { PlayerStep } from '../../lib/types';
import { shareInvite } from '../../lib/invite';

// ホームの「最近の結果」はこの件数まで。超えたら「すべての試合を見る」を出す
const RECENT_HOME_LIMIT = 3;

export default function HomeScreen() {
  const { teamId, team, user, memberCount, players, matches, upcomingMatches, recentResults, loading, isPremium, hiddenMatchCount, soonHiddenMatches } = useTeam();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const openUpgrade = (reason?: string) => { setUpgradeReason(reason); setShowUpgrade(true); };

  // 1人グループの管理者にだけ招待を促す（共有が起きていない＝有料化の前提が崩れている層）
  const isAdmin = !!user && !!team && user.uid === team.createdBy;
  const showInviteBanner = isAdmin && memberCount <= 1;

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

        {/* 招待バナー（1人グループの管理者向け） */}
        {showInviteBanner && team && (
          <TouchableOpacity
            style={styles.inviteBanner}
            onPress={() => shareInvite(team.name, team.shareCode)}
            activeOpacity={0.85}
          >
            <View style={styles.inviteIcon}>
              <Ionicons name="people" size={22} color={theme.white} />
            </View>
            <View style={styles.inviteTextWrap}>
              <Text style={styles.inviteTitle}>家族・コーチを招待しよう</Text>
              <Text style={styles.inviteSubtitle}>
                招待して、試合の記録や写真を一緒に楽しめます
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* 手前アラート：もうすぐ非表示になる試合（無料・30日以内） */}
        {!isPremium && soonHiddenMatches && (
          <TouchableOpacity
            style={styles.warnBanner}
            onPress={() =>
              openUpgrade(
                `あと${soonHiddenMatches.daysLeft}日で${soonHiddenMatches.count}件の試合記録が非表示になります。ファミリープランなら、ずっと見返せます。`
              )
            }
            activeOpacity={0.85}
          >
            <View style={styles.warnIcon}>
              <Ionicons name="alert" size={22} color={theme.white} />
            </View>
            <View style={styles.inviteTextWrap}>
              <Text style={styles.inviteTitle}>
                あと{soonHiddenMatches.daysLeft}日で{soonHiddenMatches.count}件が見れなくなります
              </Text>
              <Text style={styles.inviteSubtitle}>
                無料プランは記録を12ヶ月保持。ファミリープランなら、ずっと見返せます
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* 隠れ記録の復活訴求（無料・12ヶ月より前の記録がある場合のみ） */}
        {!isPremium && hiddenMatchCount > 0 && (
          <TouchableOpacity
            style={styles.retentionBanner}
            onPress={() =>
              openUpgrade(
                `12ヶ月より前の記録が${hiddenMatchCount}件あります。ファミリープランなら、いつでも見返せます。`
              )
            }
            activeOpacity={0.85}
          >
            <View style={styles.retentionIcon}>
              <Ionicons name="time-outline" size={22} color={theme.white} />
            </View>
            <View style={styles.inviteTextWrap}>
              <Text style={styles.inviteTitle}>過去の記録が{hiddenMatchCount}件あります</Text>
              <Text style={styles.inviteSubtitle}>
                12ヶ月より前の記録は今は非表示です（消えていません）。ファミリープランでいつでも見返せます
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
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
            {recentResults.slice(0, RECENT_HOME_LIMIT).map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                players={players}
                onPress={() => router.push(`/match/${match.id}`)}
              />
            ))}
            {recentResults.length > RECENT_HOME_LIMIT && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => router.push('/calendar')}
                activeOpacity={0.7}
              >
                <Text style={styles.moreButtonText}>すべての試合を見る</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            )}
            <AdBanner />
          </>
        )}
      </ScrollView>

      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => setShowUpgrade(false)}
        reason={upgradeReason}
      />

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
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  moreButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.primary,
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteTextWrap: { flex: 1 },
  inviteTitle: { fontSize: fontSize.md, fontWeight: '700', color: theme.text },
  inviteSubtitle: { fontSize: fontSize.xs, color: theme.textSecondary, marginTop: 2, lineHeight: 16 },
  retentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F9A825',
  },
  retentionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9A825',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFF5F5',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E53935',
  },
  warnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
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
