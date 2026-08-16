import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { Match, MatchFormData, PlayInterval } from '../../lib/types';
import { updateMatch, deleteMatch, addMatchPhoto, removeMatchPhoto, updateMatchPlayerStats } from '../../lib/firestore';
import { intervalMinutes, DEFAULT_HALF_MINUTES } from '../../lib/stats';
import { uploadMatchPhoto, deleteMatchPhotoByUrl } from '../../lib/storage';
import { PLAN_LIMITS } from '../../lib/plans';
import { MatchTypeBadge } from '../../components/MatchTypeBadge';
import { ScoreDisplay } from '../../components/ScoreDisplay';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { MatchForm, PlayerStatsMap } from '../../components/MatchForm';
import { AdBanner } from '../../components/AdBanner';
import { UpgradeModal } from '../../components/UpgradeModal';
import { PhotoViewer } from '../../components/PhotoViewer';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { ImagePicker = null; }

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

// 保存済み区間を表示用テキストへ（前半フル / 後半5分〜終了 など）
function formatInterval(iv: PlayInterval, single = false): string {
  // 旧形式
  if (iv.half == null && (iv.in != null || iv.out != null)) {
    return `${iv.in ?? 0}〜${iv.out ?? 0}分`;
  }
  const full = (iv.start === 'start' || iv.start == null) && (iv.end === 'end' || iv.end == null);
  const startTxt = iv.start === 'start' || iv.start == null ? '開始' : `${iv.start}分`;
  const endTxt = iv.end === 'end' || iv.end == null ? '終了' : `${iv.end}分`;
  if (single) {
    return full ? 'フル出場' : `${startTxt}〜${endTxt}`;
  }
  const halfLabel = iv.half === 2 ? '後半' : '前半';
  if (full) return `${halfLabel}フル`;
  return `${halfLabel} ${startTxt}〜${endTxt}`;
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { matches, teamId, players, isPremium } = useTeam();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const match = matches.find((m) => m.id === id);

  if (!match || !teamId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const date = match.date.toDate();

  const handleUpdate = async (data: MatchFormData, playerStats: PlayerStatsMap | null) => {
    setSaving(true);
    try {
      await updateMatch(teamId, match.id, data);
      if (playerStats) {
        await updateMatchPlayerStats(teamId, match.id, playerStats);
      }
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

  const photos = match.photos ?? [];
  const photoLimit = isPremium ? PLAN_LIMITS.family.matchPhotos : PLAN_LIMITS.free.matchPhotos;

  const handleAddPhoto = async () => {
    if (!ImagePicker) return;
    if (photos.length >= photoLimit) {
      if (!isPremium) setShowUpgrade(true);
      else Alert.alert('写真の上限', `1試合あたり${photoLimit}枚まで登録できます`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', '写真へのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadMatchPhoto(teamId, match.id, result.assets[0].uri);
      await addMatchPhoto(teamId, match.id, url);
    } catch {
      Alert.alert('エラー', '写真のアップロードに失敗しました');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (url: string) => {
    Alert.alert('写真を削除', 'この写真を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMatchPhoto(teamId, match.id, url);
            await deleteMatchPhotoByUrl(url);
            setViewerIndex(null);
          } catch {
            Alert.alert('エラー', '削除に失敗しました');
          }
        },
      },
    ]);
  };

  const playerIds = match.playerIds ?? [];
  // 動画URL（新: youtubeUrls配列／旧: youtubeUrl単一 の両対応）
  const videoUrls = match.youtubeUrls?.length
    ? match.youtubeUrls
    : match.youtubeUrl
      ? [match.youtubeUrl]
      : [];

  if (editing) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '試合を編集',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.push('/(tabs)')}>
                <Text style={{ color: theme.primary, fontSize: fontSize.md }}>ホームに戻る</Text>
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
            etHome: match.etHome,
            etAway: match.etAway,
            pkHome: match.pkHome,
            pkAway: match.pkAway,
            noResult: match.noResult,
            periodFormat: match.periodFormat,
            notes: match.notes,
            youtubeUrl: match.youtubeUrl,
            youtubeUrls: match.youtubeUrls,
            status: match.status,
            halfMinutes: match.halfMinutes,
            playerIds: match.playerIds ?? [],
          }}
          initialPlayerStats={match.playerStats}
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
            etHome={match.etHome}
            etAway={match.etAway}
            pkHome={match.pkHome}
            pkAway={match.pkAway}
            noResult={match.noResult}
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

        {/* 選手スタッツ */}
        {playerIds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.statsHeader}>
              <Text style={styles.sectionTitle}>選手スタッツ</Text>
              <Text style={styles.statsEditHint}>「編集」から登録</Text>
            </View>

            {!isPremium ? (
              <TouchableOpacity style={styles.statsLocked} onPress={() => setShowUpgrade(true)}>
                <Ionicons name="lock-closed" size={20} color={theme.textSecondary} />
                <Text style={styles.statsLockedText}>
                  選手ごとの得点・アシスト・出場時間はファミリープランで記録できます
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.statsCard}>
                {playerIds.map((pid, idx) => {
                  const p = players.find((pl) => pl.id === pid);
                  if (!p) return null;
                  const s = match.playerStats?.[pid];
                  const g = s?.goals ?? 0;
                  const a = s?.assists ?? 0;
                  const c = s?.clears ?? 0;
                  const ivs = s?.intervals ?? [];
                  const matchHalf = match.halfMinutes ?? DEFAULT_HALF_MINUTES;
                  const minutes = ivs.reduce((sum, iv) => sum + intervalMinutes(iv, matchHalf), 0);
                  const ivLabel = ivs.map((iv) => formatInterval(iv, match.periodFormat === 'single')).join(' / ');
                  return (
                    <View
                      key={pid}
                      style={[styles.statReadRow, idx < playerIds.length - 1 && styles.statReadBorder]}
                    >
                      <View style={styles.statReadTop}>
                        <TouchableOpacity
                          style={styles.statNameTap}
                          onPress={() => router.push(`/player/${pid}`)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.statPlayerName} numberOfLines={1}>
                            {p.number != null ? `#${p.number}  ` : ''}{p.name}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.statReadNums}>
                          <Text style={styles.statReadVal}>⚽ {g}</Text>
                          <Text style={styles.statReadVal}>A {a}</Text>
                          <Text style={styles.statReadVal}>🛡 {c}</Text>
                        </View>
                      </View>
                      {minutes > 0 && (
                        <Text style={styles.statReadMin}>
                          出場 {minutes}分{ivLabel ? `（${ivLabel}）` : ''}
                        </Text>
                      )}
                      {!!s?.note && <Text style={styles.statReadNote}>{s.note}</Text>}
                    </View>
                  );
                })}
                {!match.playerStats && (
                  <Text style={styles.statsEmptyHint}>「編集」から得点・アシスト・出場時間を記録できます</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* 動画（複数可） */}
        {videoUrls.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>動画</Text>
            {videoUrls.map((url, i) => (
              <View key={i} style={i > 0 ? { marginTop: spacing.md } : undefined}>
                <YouTubePlayer url={url} />
              </View>
            ))}
          </View>
        ) : (
          <AdBanner rectangle />
        )}

        {/* 試合の写真 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>試合の写真</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
          >
            {photos.map((url, i) => (
              <TouchableOpacity key={url} onPress={() => setViewerIndex(i)} activeOpacity={0.85}>
                <Image source={{ uri: url }} style={styles.photoThumb} />
              </TouchableOpacity>
            ))}
            {photos.length < photoLimit ? (
              <TouchableOpacity style={styles.photoAdd} onPress={handleAddPhoto} disabled={uploadingPhoto}>
                {uploadingPhoto ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={26} color={theme.primary} />
                    <Text style={styles.photoAddText}>追加</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : !isPremium ? (
              <TouchableOpacity style={styles.photoLocked} onPress={() => setShowUpgrade(true)}>
                <Ionicons name="lock-closed" size={22} color={theme.textSecondary} />
                <Text style={styles.photoLockedText}>もっと残す</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
          <Text style={styles.photoHint}>
            {isPremium
              ? `${photos.length}/${photoLimit}枚`
              : `無料は1試合${photoLimit}枚まで・ファミリーなら20枚まで残せます`}
          </Text>
        </View>

        {/* メモ */}
        {match.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>メモ</Text>
            <Text style={styles.notes}>{match.notes}</Text>
          </View>
        )}

        <AdBanner />

        {/* ホームに戻る */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="home-outline" size={20} color={theme.primary} />
          <Text style={styles.homeButtonText}>ホームに戻る</Text>
        </TouchableOpacity>
      </ScrollView>

      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => setShowUpgrade(false)}
        reason="試合の写真をもっと残すには、ファミリープランがおすすめです"
      />

      <PhotoViewer
        visible={viewerIndex !== null}
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        onDelete={handleDeletePhoto}
      />
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
  photoRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    backgroundColor: theme.surface,
  },
  photoAdd: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.white,
    gap: 2,
  },
  photoAddText: {
    fontSize: fontSize.xs,
    color: theme.primary,
    fontWeight: '600',
  },
  photoLocked: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    gap: 2,
  },
  photoLockedText: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  photoHint: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: spacing.xs,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statsEditHint: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
  },
  statsLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  statsLockedText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statReadRow: {
    paddingVertical: spacing.sm + 2,
  },
  statReadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statReadBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  statReadNums: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statReadVal: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.text,
  },
  statReadMin: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  statReadNote: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  statsEmptyHint: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  statPlayerName: {
    fontSize: fontSize.md,
    fontWeight: '400',
    color: theme.text,
    flexShrink: 1,
    marginBottom: spacing.xs,
  },
  statNameTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
});
