import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { Match, MatchFormData } from '../../lib/types';
import { updateMatch, deleteMatch } from '../../lib/firestore';
import { MatchTypeBadge } from '../../components/MatchTypeBadge';
import { ScoreDisplay } from '../../components/ScoreDisplay';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { MatchForm } from '../../components/MatchForm';

function formatFullDate(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${y}年${m}月${d}日(${day}) ${h}:${min}`;
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { matches, teamId } = useTeam();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const match = matches.find((m) => m.id === id);

  if (!match || !teamId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const date = match.date.toDate();

  const handleUpdate = async (data: MatchFormData) => {
    setSaving(true);
    try {
      await updateMatch(teamId, match.id, data);
      setEditing(false);
    } catch {
      Alert.alert('エラー', '更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMatch(teamId, match.id);
      router.back();
    } catch {
      Alert.alert('エラー', '削除に失敗しました');
    }
  };

  if (editing) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '試合を編集',
            headerLeft: () => (
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={{ color: theme.primary, fontSize: fontSize.md }}>キャンセル</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <MatchForm
          initialData={{
            date: match.date.toDate(),
            opponent: match.opponent,
            venue: match.venue,
            venueId: match.venueId,
            matchType: match.matchType,
            competitionName: match.competitionName,
            scoreHome: match.scoreHome,
            scoreAway: match.scoreAway,
            notes: match.notes,
            youtubeUrl: match.youtubeUrl,
            status: match.status,
          }}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
          isEditing
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Ionicons name="pencil" size={22} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ステータスバッジ */}
        <View style={styles.topRow}>
          <MatchTypeBadge type={match.matchType} competitionName={match.competitionName} />
          <Text style={styles.statusText}>
            {match.status === 'upcoming' ? '予定' : '終了'}
          </Text>
        </View>

        {/* スコアボード */}
        <View style={styles.scoreBoard}>
          <View style={styles.teamColumn}>
            <Ionicons name="football" size={32} color={theme.primary} />
            <Text style={styles.teamLabel}>自チーム</Text>
          </View>
          <ScoreDisplay
            scoreHome={match.scoreHome}
            scoreAway={match.scoreAway}
            result={match.result}
            size="large"
          />
          <View style={styles.teamColumn}>
            <Ionicons name="shield-outline" size={32} color={theme.textSecondary} />
            <Text style={styles.teamLabel}>{match.opponent}</Text>
          </View>
        </View>

        {/* 試合情報 */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.infoText}>{formatFullDate(date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.infoText}>{match.venue}</Text>
          </View>
          {match.competitionName && (
            <View style={styles.infoRow}>
              <Ionicons name="trophy-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.infoText}>{match.competitionName}</Text>
            </View>
          )}
        </View>

        {/* YouTube */}
        {match.youtubeUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>動画</Text>
            <YouTubePlayer url={match.youtubeUrl} />
          </View>
        )}

        {/* メモ */}
        {match.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>メモ</Text>
            <Text style={styles.notes}>{match.notes}</Text>
          </View>
        )}

        {/* ホームに戻る */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="home-outline" size={20} color={theme.primary} />
          <Text style={styles.homeButtonText}>ホームに戻る</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
  },
  teamLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: theme.text,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
  },
  notes: {
    fontSize: fontSize.md,
    color: theme.text,
    lineHeight: 24,
    backgroundColor: theme.surface,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  homeButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.primary,
  },
});
