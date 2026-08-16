import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import {
  subscribeToPlayerSteps,
  createPlayerStep,
  updatePlayerStep,
  deletePlayerStep,
  updatePlayerPhoto,
  updatePlayer,
  createToreisenRecord,
  updateToreisenRecord,
  deleteToreisenRecord,
  subscribeToToreisenRecords,
} from '../../lib/firestore';
import { uploadPlayerPhoto } from '../../lib/storage';
import { PlayerStep, PlayerPosition, ToreisenRecord, ToreisenLevel } from '../../lib/types';
import { computePlayerTotals, computePlayerSplit, computePlayerYearlyTotals } from '../../lib/stats';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { ImagePicker = null; }

const POSITION_LABELS: Record<PlayerPosition, string> = {
  GK: 'GK', CB: 'CB', RSB: '右SB', LSB: '左SB',
  'ボランチ': 'ボランチ', CMF: 'CMF', 'トップ下': 'トップ下',
  RSH: '右SH', LSH: '左SH', RWG: '右WG', LWG: '左WG', CF: 'CF',
};

const ALL_POSITIONS: PlayerPosition[] = [
  'GK', 'CB', 'RSB', 'LSB', 'ボランチ', 'CMF', 'トップ下', 'RSH', 'LSH', 'RWG', 'LWG', 'CF',
];

const TOREISEN_LEVELS: { level: ToreisenLevel; label: string; color: string }[] = [
  { level: 'district',   label: '地区トレ',   color: '#78909C' },
  { level: 'city',       label: '市区トレ',   color: '#26A69A' },
  { level: 'prefecture', label: '県トレ',     color: '#42A5F5' },
  { level: 'region',     label: '地域トレ',   color: '#AB47BC' },
  { level: 'national',   label: '全国トレ',   color: '#EF5350' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 15 }, (_, i) => currentYear - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return '現在';
  const d = ts.toDate();
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// 年月ピッカーコンポーネント
function YearMonthPicker({
  year, month, onChange,
}: {
  year: number; month: number; onChange: (year: number, month: number) => void;
}) {
  return (
    <View style={styles.ymPickerRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ymScroll}>
        {YEARS.map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.ymChip, y === year && styles.ymChipSelected]}
            onPress={() => onChange(y, month)}
          >
            <Text style={[styles.ymChipText, y === year && styles.ymChipTextSelected]}>{y}年</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ymScroll}>
        {MONTHS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.ymChip, m === month && styles.ymChipSelected]}
            onPress={() => onChange(year, m)}
          >
            <Text style={[styles.ymChipText, m === month && styles.ymChipTextSelected]}>{m}月</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, teamId, hasFeature, matches } = useTeam();
  const player = players.find((p) => p.id === id);

  const canUseFamily = hasFeature('stepRecords');
  const canUsePlayerStats = hasFeature('playerStats');
  const [showMoreStats, setShowMoreStats] = useState(true);
  const [showAllMatches, setShowAllMatches] = useState(false);

  const [steps, setSteps] = useState<PlayerStep[]>([]);
  const [toreisenList, setToreisenList] = useState<ToreisenRecord[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 所属履歴フォーム
  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState<PlayerStep | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const [stepTeamName, setStepTeamName] = useState('');
  const [stepNumber, setStepNumber] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<PlayerPosition[]>([]);
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [stepNote, setStepNote] = useState('');

  // 基本情報編集
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileNumber, setEditProfileNumber] = useState('');
  const [editProfilePositions, setEditProfilePositions] = useState<PlayerPosition[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const openProfileEdit = () => {
    if (!player) return;
    setEditProfileName(player.name);
    setEditProfileNumber(player.number != null ? String(player.number) : '');
    setEditProfilePositions(player.positions ?? []);
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editProfileName.trim()) { Alert.alert('入力エラー', '名前を入力してください'); return; }
    if (!teamId || !id) return;
    setSavingProfile(true);
    try {
      await updatePlayer(teamId, id, {
        name: editProfileName.trim(),
        number: editProfileNumber ? parseInt(editProfileNumber, 10) : null,
        positions: editProfilePositions,
      });
      setEditingProfile(false);
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setSavingProfile(false);
    }
  };

  // トレセンフォーム
  const [showToreisenForm, setShowToreisenForm] = useState(false);
  const [editingToreisen, setEditingToreisen] = useState<ToreisenRecord | null>(null);
  const [savingToreisen, setSavingToreisen] = useState(false);
  const [toreisenLevel, setToreisenLevel] = useState<ToreisenLevel>('prefecture');
  const [toreisenYear, setToreisenYear] = useState(currentYear);
  const [toreisenAgeGroup, setToreisenAgeGroup] = useState('');
  const [toreisenNote, setToreisenNote] = useState('');

  useEffect(() => {
    if (!teamId || !id || !canUseFamily) return;
    const unsub1 = subscribeToPlayerSteps(teamId, id, setSteps);
    const unsub2 = subscribeToToreisenRecords(teamId, id, setToreisenList);
    return () => { unsub1(); unsub2(); };
  }, [teamId, id, canUseFamily]);

  const handlePickPhoto = async () => {
    if (!teamId || !id || !ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', '写真へのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPlayerPhoto(teamId, id, result.assets[0].uri);
      await updatePlayerPhoto(teamId, id, url);
    } catch {
      Alert.alert('エラー', '写真のアップロードに失敗しました');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openStepForm = (step?: PlayerStep) => {
    if (step) {
      setEditingStep(step);
      setStepTeamName(step.teamName);
      setStepNumber(step.number?.toString() ?? '');
      setSelectedPositions(step.positions ?? []);
      const sd = step.startDate.toDate();
      setStartYear(sd.getFullYear());
      setStartMonth(sd.getMonth() + 1);
      if (step.endDate) {
        const ed = step.endDate.toDate();
        setEndYear(ed.getFullYear());
        setEndMonth(ed.getMonth() + 1);
        setHasEndDate(true);
      } else {
        setHasEndDate(false);
      }
      setStepNote(step.note ?? '');
    } else {
      setEditingStep(null);
      setStepTeamName(''); setStepNumber(''); setSelectedPositions([]);
      setStartYear(currentYear); setStartMonth(new Date().getMonth() + 1);
      setEndYear(currentYear); setEndMonth(new Date().getMonth() + 1);
      setHasEndDate(false); setStepNote('');
    }
    setShowStepForm(true);
  };

  const resetStepForm = () => {
    setShowStepForm(false);
    setEditingStep(null);
  };

  const handleSaveStep = async () => {
    if (!stepTeamName.trim()) { Alert.alert('入力エラー', 'チーム名を入力してください'); return; }
    if (!teamId || !id) return;
    const startDate = new Date(startYear, startMonth - 1, 1);
    const endDate = hasEndDate ? new Date(endYear, endMonth - 1, 1) : undefined;
    setSavingStep(true);
    try {
      if (editingStep) {
        await updatePlayerStep(teamId, id, editingStep.id, {
          teamName: stepTeamName.trim(),
          number: stepNumber ? parseInt(stepNumber, 10) : null,
          positions: selectedPositions,
          startDate,
          endDate: endDate ?? null,
          note: stepNote.trim() || undefined,
        });
      } else {
        await createPlayerStep(teamId, id, {
          teamName: stepTeamName.trim(),
          number: stepNumber ? parseInt(stepNumber, 10) : undefined,
          positions: selectedPositions,
          startDate,
          endDate,
          note: stepNote.trim() || undefined,
        });
      }
      resetStepForm();
    } catch {
      Alert.alert('エラー', '記録の保存に失敗しました');
    } finally {
      setSavingStep(false);
    }
  };

  const handleDeleteStep = (step: PlayerStep) => {
    if (!teamId || !id) return;
    Alert.alert('確認', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deletePlayerStep(teamId, id, step.id) },
    ]);
  };

  const openToreisenForm = (record?: ToreisenRecord) => {
    if (record) {
      setEditingToreisen(record);
      setToreisenLevel(record.level);
      setToreisenYear(record.year);
      setToreisenAgeGroup(record.ageGroup ?? '');
      setToreisenNote(record.note ?? '');
    } else {
      setEditingToreisen(null);
      setToreisenLevel('prefecture');
      setToreisenYear(currentYear);
      setToreisenAgeGroup('');
      setToreisenNote('');
    }
    setShowToreisenForm(true);
  };

  const handleSaveToreisen = async () => {
    if (!teamId || !id) return;
    const levelInfo = TOREISEN_LEVELS.find((l) => l.level === toreisenLevel)!;
    setSavingToreisen(true);
    try {
      if (editingToreisen) {
        await updateToreisenRecord(teamId, id, editingToreisen.id, {
          level: toreisenLevel,
          levelLabel: levelInfo.label,
          year: toreisenYear,
          ageGroup: toreisenAgeGroup.trim() || undefined,
          note: toreisenNote.trim() || undefined,
        });
      } else {
        await createToreisenRecord(teamId, id, {
          level: toreisenLevel,
          levelLabel: levelInfo.label,
          year: toreisenYear,
          ageGroup: toreisenAgeGroup.trim() || undefined,
          note: toreisenNote.trim() || undefined,
        });
      }
      setShowToreisenForm(false);
      setEditingToreisen(null);
    } catch {
      Alert.alert('エラー', '記録の保存に失敗しました');
    } finally {
      setSavingToreisen(false);
    }
  };

  const handleDeleteToreisen = (record: ToreisenRecord) => {
    if (!teamId || !id) return;
    Alert.alert('確認', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteToreisenRecord(teamId, id, record.id) },
    ]);
  };

  if (!player) {
    return (
      <>
        <Stack.Screen options={{ title: '選手詳細' }} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </>
    );
  }

  // 出場試合の集計
  const participatedMatches = matches
    .filter((m) => (m.playerIds ?? []).includes(player.id))
    .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  const totalMatches = participatedMatches.length;
  const completedMatches = participatedMatches.filter((m) => m.result != null);
  const wins = completedMatches.filter((m) => m.result === 'win').length;
  const draws = completedMatches.filter((m) => m.result === 'draw').length;
  const losses = completedMatches.filter((m) => m.result === 'loss').length;
  const {
    matches: statMatchCount,
    goals: playerGoals,
    assists: playerAssists,
    clears: playerClears,
    minutes: playerMinutes,
  } = computePlayerTotals(matches, player.id);
  const playerSplit = computePlayerSplit(matches, player.id);
  const playerYearly = computePlayerYearlyTotals(matches, player.id);
  const avg = (v: number) => (statMatchCount > 0 ? (v / statMatchCount).toFixed(1) : '0.0');

  function formatMatchDate(d: Date): string {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: player.name,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ paddingHorizontal: 4, paddingVertical: 4 }}
            >
              <Ionicons name="chevron-back" size={28} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* 基本情報 */}
        {editingProfile ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>基本情報を編集</Text>
            <TextInput
              style={styles.input}
              value={editProfileName}
              onChangeText={setEditProfileName}
              placeholder="名前 *"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <TextInput
              style={[styles.input, { marginTop: spacing.sm }]}
              value={editProfileNumber}
              onChangeText={setEditProfileNumber}
              placeholder="背番号（任意）"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={styles.formLabel}>ポジション（任意）</Text>
            <View style={styles.positionRow}>
              {ALL_POSITIONS.map((pos) => {
                const sel = editProfilePositions.includes(pos);
                return (
                  <TouchableOpacity
                    key={pos}
                    style={[styles.positionOption, sel && styles.positionOptionSelected]}
                    onPress={() => setEditProfilePositions((prev) =>
                      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
                    )}
                  >
                    <Text style={[styles.positionOptionText, sel && { color: theme.white }]}>{POSITION_LABELS[pos]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.formButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingProfile(false)}>
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, savingProfile && { opacity: 0.6 }]} onPress={handleSaveProfile} disabled={savingProfile}>
                <Text style={styles.saveButtonText}>{savingProfile ? '保存中...' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileCard}>
            {canUseFamily && (
              <TouchableOpacity style={styles.photoArea} onPress={handlePickPhoto} disabled={uploadingPhoto}>
                {uploadingPhoto ? (
                  <View style={styles.photoPlaceholder}>
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : player.photoUrl ? (
                  <Image source={{ uri: player.photoUrl }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={theme.textSecondary} />
                    <Text style={styles.photoHint}>写真を追加</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              {player.number != null && (
                <Text style={styles.playerNumber}>背番号 #{player.number}</Text>
              )}
              <View style={styles.positionTags}>
                {(player.positions || []).map((pos) => (
                  <View key={pos} style={styles.positionTag}>
                    <Text style={styles.positionTagText}>{POSITION_LABELS[pos]}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity onPress={openProfileEdit} style={styles.editBtn}>
              <Ionicons name="pencil-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* 出場試合 */}
        {totalMatches > 0 && (
          <>
            <Text style={styles.sectionTitle}>出場試合</Text>
            <View style={styles.matchStatsRow}>
              <View style={styles.matchStatItem}>
                <Text style={styles.matchStatNum}>{totalMatches}</Text>
                <Text style={styles.matchStatLabel}>試合</Text>
              </View>
              {completedMatches.length > 0 && (
                <>
                  <View style={[styles.matchStatItem, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.matchStatNum, { color: theme.win }]}>{wins}</Text>
                    <Text style={styles.matchStatLabel}>勝</Text>
                  </View>
                  <View style={[styles.matchStatItem, { backgroundColor: '#FFF8E1' }]}>
                    <Text style={[styles.matchStatNum, { color: '#F9A825' }]}>{draws}</Text>
                    <Text style={styles.matchStatLabel}>分</Text>
                  </View>
                  <View style={[styles.matchStatItem, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.matchStatNum, { color: theme.loss }]}>{losses}</Text>
                    <Text style={styles.matchStatLabel}>敗</Text>
                  </View>
                </>
              )}
            </View>
            {canUsePlayerStats && (
              <View style={styles.matchStatsRow}>
                <View style={[styles.matchStatItem, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.matchStatNum, { color: theme.officialBadge }]}>{playerGoals}</Text>
                  <Text style={styles.matchStatLabel}>得点</Text>
                </View>
                <View style={[styles.matchStatItem, { backgroundColor: '#F3E5F5' }]}>
                  <Text style={[styles.matchStatNum, { color: '#8E24AA' }]}>{playerAssists}</Text>
                  <Text style={styles.matchStatLabel}>アシスト</Text>
                </View>
                <View style={[styles.matchStatItem, { backgroundColor: '#E0F2F1' }]}>
                  <Text style={[styles.matchStatNum, { color: '#00897B' }]}>{playerClears}</Text>
                  <Text style={styles.matchStatLabel}>ブロック</Text>
                </View>
              </View>
            )}
            {(showAllMatches ? participatedMatches : participatedMatches.slice(0, 5)).map((m) => {
              const ps = canUsePlayerStats ? m.playerStats?.[player.id] : undefined;
              const hasPs = !!ps && ((ps.goals ?? 0) > 0 || (ps.assists ?? 0) > 0 || (ps.clears ?? 0) > 0);
              return (
              <TouchableOpacity
                key={m.id}
                style={styles.matchRow}
                onPress={() => router.push(`/match/${m.id}`)}
              >
                <Text style={styles.matchRowDate}>{formatMatchDate(m.date.toDate())}</Text>
                <Text style={styles.matchRowOpponent} numberOfLines={1}>vs {m.opponent}</Text>
                {hasPs && (
                  <Text style={styles.matchRowPs}>
                    {(ps!.goals ?? 0) > 0 ? `⚽${ps!.goals}` : ''}
                    {(ps!.assists ?? 0) > 0 ? ` A${ps!.assists}` : ''}
                    {(ps!.clears ?? 0) > 0 ? ` 🛡${ps!.clears}` : ''}
                  </Text>
                )}
                {m.result != null ? (
                  <View style={[styles.resultBadge, { backgroundColor: m.result === 'win' ? theme.win : m.result === 'loss' ? theme.loss : '#F9A825' }]}>
                    <Text style={styles.resultBadgeText}>{m.result === 'win' ? '勝' : m.result === 'loss' ? '敗' : '分'}</Text>
                  </View>
                ) : (
                  <View style={[styles.resultBadge, { backgroundColor: theme.border }]}>
                    <Text style={[styles.resultBadgeText, { color: theme.textSecondary }]}>予定</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
              );
            })}

            {participatedMatches.length > 5 && (
              <TouchableOpacity
                style={styles.moreMatchesBtn}
                onPress={() => setShowAllMatches((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.moreMatchesText}>
                  {showAllMatches ? '閉じる' : `もっと見る（全${participatedMatches.length}試合）`}
                </Text>
                <Ionicons
                  name={showAllMatches ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.primary}
                />
              </TouchableOpacity>
            )}

            {/* もっと詳しく（区分別／出場時間／年度別） */}
            {canUsePlayerStats &&
              (playerGoals > 0 || playerAssists > 0 || playerClears > 0 || playerMinutes > 0) && (
              <>
                <TouchableOpacity
                  style={styles.moreStatsToggle}
                  onPress={() => setShowMoreStats((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moreStatsToggleText}>もっと詳しく</Text>
                  <Ionicons
                    name={showMoreStats ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.primary}
                  />
                </TouchableOpacity>

                {showMoreStats && (
                  <View style={styles.moreStatsBox}>
                    {/* 区分別 */}
                    <Text style={styles.moreStatsHeading}>区分別</Text>
                    <View style={styles.moreStatsHeaderRow}>
                      <Text style={[styles.moreStatsCell, styles.moreStatsCellLabel]}> </Text>
                      <Text style={styles.moreStatsCell}>試合</Text>
                      <Text style={styles.moreStatsCell}>得点</Text>
                      <Text style={styles.moreStatsCell}>アシスト</Text>
                      <Text style={styles.moreStatsCell}>ブロック</Text>
                    </View>
                    <View style={styles.moreStatsDataRow}>
                      <Text style={[styles.moreStatsCell, styles.moreStatsCellLabel]}>公式戦</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.official.matches}</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.official.goals}</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.official.assists}</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.official.clears}</Text>
                    </View>
                    {playerSplit.subOfficial.matches > 0 && (
                      <View style={styles.moreStatsDataRow}>
                        <Text style={[styles.moreStatsCell, styles.moreStatsCellLabel]}>サブ公式戦</Text>
                        <Text style={styles.moreStatsCell}>{playerSplit.subOfficial.matches}</Text>
                        <Text style={styles.moreStatsCell}>{playerSplit.subOfficial.goals}</Text>
                        <Text style={styles.moreStatsCell}>{playerSplit.subOfficial.assists}</Text>
                        <Text style={styles.moreStatsCell}>{playerSplit.subOfficial.clears}</Text>
                      </View>
                    )}
                    <View style={styles.moreStatsDataRow}>
                      <Text style={[styles.moreStatsCell, styles.moreStatsCellLabel]}>練習試合</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.practice.matches}</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.practice.goals}</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.practice.assists}</Text>
                      <Text style={styles.moreStatsCell}>{playerSplit.practice.clears}</Text>
                    </View>

                    {/* 1試合平均・出場時間 */}
                    <Text style={[styles.moreStatsHeading, { marginTop: spacing.md }]}>1試合平均</Text>
                    <Text style={styles.moreStatsAvg}>
                      得点 {avg(playerGoals)}　アシスト {avg(playerAssists)}　ブロック {avg(playerClears)}
                    </Text>
                    {playerMinutes > 0 && (
                      <Text style={[styles.moreStatsAvg, { marginTop: 4 }]}>
                        出場時間 合計 {playerMinutes}分　平均 {avg(playerMinutes)}分
                      </Text>
                    )}

                    {/* 年度別 */}
                    {playerYearly.length > 1 && (
                      <>
                        <Text style={[styles.moreStatsHeading, { marginTop: spacing.md }]}>年度別</Text>
                        <View style={styles.moreStatsHeaderRow}>
                          <Text style={[styles.moreStatsCell, styles.moreStatsCellLabel]}> </Text>
                          <Text style={styles.moreStatsCell}>試合</Text>
                          <Text style={styles.moreStatsCell}>得点</Text>
                          <Text style={styles.moreStatsCell}>アシスト</Text>
                          <Text style={styles.moreStatsCell}>ブロック</Text>
                        </View>
                        {playerYearly.map((y) => (
                          <View key={y.fiscalYear} style={styles.moreStatsDataRow}>
                            <Text style={[styles.moreStatsCell, styles.moreStatsCellLabel]}>{y.fiscalYear}年度</Text>
                            <Text style={styles.moreStatsCell}>{y.totals.matches}</Text>
                            <Text style={styles.moreStatsCell}>{y.totals.goals}</Text>
                            <Text style={styles.moreStatsCell}>{y.totals.assists}</Text>
                            <Text style={styles.moreStatsCell}>{y.totals.clears}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {canUseFamily ? (
          <>
            {/* 所属履歴 */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>所属チーム履歴</Text>
            {steps.map((step) => (
              <View key={step.id} style={styles.stepCard}>
                <View style={styles.stepMain}>
                  <Text style={styles.stepTeamName}>{step.teamName}</Text>
                  <Text style={styles.stepPeriod}>
                    {formatDate(step.startDate)} 〜 {formatDate(step.endDate)}
                  </Text>
                  {step.number != null && <Text style={styles.stepSub}>背番号 #{step.number}</Text>}
                  {step.positions.length > 0 && (
                    <Text style={styles.stepSub}>{step.positions.map((p) => POSITION_LABELS[p]).join(' / ')}</Text>
                  )}
                  {step.note && <Text style={styles.stepNote}>{step.note}</Text>}
                </View>
                <TouchableOpacity onPress={() => openStepForm(step)} style={styles.editBtn}>
                  <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteStep(step)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {showStepForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{editingStep ? '所属を編集' : '所属を追加'}</Text>
                <TextInput style={styles.input} value={stepTeamName} onChangeText={setStepTeamName} placeholder="チーム名 *" placeholderTextColor={theme.textSecondary} autoFocus />
                <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={stepNumber} onChangeText={setStepNumber} placeholder="背番号（任意）" placeholderTextColor={theme.textSecondary} keyboardType="number-pad" />
                <Text style={styles.formLabel}>ポジション（任意）</Text>
                <View style={styles.positionRow}>
                  {ALL_POSITIONS.map((pos) => {
                    const sel = selectedPositions.includes(pos);
                    return (
                      <TouchableOpacity key={pos} style={[styles.positionOption, sel && styles.positionOptionSelected]}
                        onPress={() => setSelectedPositions((prev) => prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos])}>
                        <Text style={[styles.positionOptionText, sel && { color: theme.white }]}>{POSITION_LABELS[pos]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.formLabel}>所属開始</Text>
                <YearMonthPicker year={startYear} month={startMonth} onChange={(y, m) => { setStartYear(y); setStartMonth(m); }} />
                <Text style={styles.formLabel}>所属終了</Text>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setHasEndDate(!hasEndDate)}>
                  <Ionicons name={hasEndDate ? 'checkbox' : 'square-outline'} size={20} color={hasEndDate ? theme.primary : theme.textSecondary} />
                  <Text style={styles.toggleText}>終了日あり（空白 = 現在も在籍）</Text>
                </TouchableOpacity>
                {hasEndDate && (
                  <YearMonthPicker year={endYear} month={endMonth} onChange={(y, m) => { setEndYear(y); setEndMonth(m); }} />
                )}
                <TextInput style={[styles.input, { marginTop: spacing.md }]} value={stepNote} onChangeText={setStepNote} placeholder="メモ（任意）" placeholderTextColor={theme.textSecondary} />
                <View style={styles.formButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={resetStepForm}>
                    <Text style={styles.cancelButtonText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, savingStep && { opacity: 0.6 }]} onPress={handleSaveStep} disabled={savingStep}>
                    <Text style={styles.saveButtonText}>{savingStep ? '保存中...' : '保存'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={() => openStepForm()}>
                <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
                <Text style={styles.addButtonText}>所属を追加</Text>
              </TouchableOpacity>
            )}

            {/* トレセン歴 */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>トレセン歴</Text>
            {toreisenList.map((record) => {
              const levelInfo = TOREISEN_LEVELS.find((l) => l.level === record.level);
              return (
                <View key={record.id} style={styles.toreisenCard}>
                  <View style={[styles.toreisenBadge, { backgroundColor: levelInfo?.color ?? '#78909C' }]}>
                    <Text style={styles.toreisenBadgeText}>{record.levelLabel}</Text>
                  </View>
                  <View style={styles.toreisenInfo}>
                    <Text style={styles.toreisenYear}>{record.year}年度</Text>
                    {record.ageGroup && <Text style={styles.toreisenSub}>{record.ageGroup}</Text>}
                    {record.note && <Text style={styles.stepNote}>{record.note}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => openToreisenForm(record)} style={styles.editBtn}>
                    <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteToreisen(record)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {showToreisenForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{editingToreisen ? 'トレセン歴を編集' : 'トレセン歴を追加'}</Text>
                <Text style={styles.formLabel}>レベル</Text>
                <View style={styles.levelRow}>
                  {TOREISEN_LEVELS.map((l) => (
                    <TouchableOpacity
                      key={l.level}
                      style={[styles.levelChip, toreisenLevel === l.level && { backgroundColor: l.color, borderColor: l.color }]}
                      onPress={() => setToreisenLevel(l.level)}
                    >
                      <Text style={[styles.levelChipText, toreisenLevel === l.level && { color: theme.white }]}>{l.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.formLabel}>年度</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                  {YEARS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.yearChip, toreisenYear === y && styles.yearChipSelected]}
                      onPress={() => setToreisenYear(y)}
                    >
                      <Text style={[styles.levelChipText, toreisenYear === y && { color: theme.white }]}>{y}年</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={styles.input} value={toreisenAgeGroup} onChangeText={setToreisenAgeGroup} placeholder="年代（例: U-12）（任意）" placeholderTextColor={theme.textSecondary} />
                <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={toreisenNote} onChangeText={setToreisenNote} placeholder="メモ（任意）" placeholderTextColor={theme.textSecondary} />
                <View style={styles.formButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowToreisenForm(false); setEditingToreisen(null); }}>
                    <Text style={styles.cancelButtonText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, savingToreisen && { opacity: 0.6 }]} onPress={handleSaveToreisen} disabled={savingToreisen}>
                    <Text style={styles.saveButtonText}>{savingToreisen ? '保存中...' : '保存'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addButton} onPress={() => openToreisenForm()}>
                <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
                <Text style={styles.addButtonText}>トレセン歴を追加</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={32} color={theme.textSecondary} />
            <Text style={styles.lockedText}>子ども情報の詳細管理はファミリープランで利用できます</Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/(tabs)/settings')}>
              <Text style={styles.upgradeButtonText}>プランを確認する</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  profileCard: {
    backgroundColor: theme.white, borderRadius: borderRadius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: theme.border,
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
  },
  photoArea: { alignItems: 'center' },
  photo: { width: 80, height: 80, borderRadius: borderRadius.md },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: borderRadius.md, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoHint: { fontSize: 10, color: theme.textSecondary, textAlign: 'center' },
  profileInfo: { flex: 1 },
  playerName: { fontSize: fontSize.xl, fontWeight: '800', color: theme.text },
  playerNumber: { fontSize: fontSize.sm, color: theme.textSecondary, marginTop: 2 },
  positionTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
  positionTag: { backgroundColor: theme.primary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  positionTagText: { fontSize: fontSize.xs, fontWeight: '700', color: theme.white },
  sectionTitle: {
    fontSize: fontSize.sm, fontWeight: '700', color: theme.textSecondary,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  stepCard: {
    backgroundColor: theme.white, borderRadius: borderRadius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: theme.border,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  stepMain: { flex: 1 },
  stepTeamName: { fontSize: fontSize.md, fontWeight: '700', color: theme.text },
  stepPeriod: { fontSize: fontSize.sm, color: theme.primary, marginTop: 2 },
  stepSub: { fontSize: fontSize.xs, color: theme.textSecondary, marginTop: 2 },
  stepNote: { fontSize: fontSize.xs, color: theme.textSecondary, marginTop: spacing.xs, fontStyle: 'italic' },
  editBtn: { padding: spacing.xs },
  deleteBtn: { padding: spacing.xs },
  toreisenCard: {
    backgroundColor: theme.white, borderRadius: borderRadius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: theme.border,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  toreisenBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, alignSelf: 'flex-start',
  },
  toreisenBadgeText: { fontSize: fontSize.xs, fontWeight: '700', color: theme.white },
  toreisenInfo: { flex: 1 },
  toreisenYear: { fontSize: fontSize.md, fontWeight: '700', color: theme.text },
  toreisenSub: { fontSize: fontSize.xs, color: theme.textSecondary },
  formCard: { backgroundColor: theme.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  formTitle: { fontSize: fontSize.md, fontWeight: '700', color: theme.text, marginBottom: spacing.sm },
  formLabel: { fontSize: fontSize.sm, fontWeight: '600', color: theme.text, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: borderRadius.sm,
    padding: spacing.sm + 4, fontSize: fontSize.md, color: theme.text, backgroundColor: theme.white,
  },
  positionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  positionOption: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.white,
  },
  positionOptionSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  positionOptionText: { fontSize: fontSize.xs, fontWeight: '700', color: theme.textSecondary },
  ymPickerRow: { gap: 6 },
  ymScroll: { flexGrow: 0, marginBottom: 4 },
  ymChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: theme.border,
    backgroundColor: theme.white, marginRight: spacing.sm,
  },
  ymChipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  ymChipText: { fontSize: fontSize.xs, fontWeight: '700', color: theme.textSecondary },
  ymChipTextSelected: { color: theme.white },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  toggleText: { fontSize: fontSize.sm, color: theme.text },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  levelChip: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.white,
  },
  levelChipText: { fontSize: fontSize.xs, fontWeight: '700', color: theme.textSecondary },
  yearChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: theme.border,
    backgroundColor: theme.white, marginRight: spacing.sm,
  },
  yearChipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelButton: {
    flex: 1, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: theme.border, alignItems: 'center',
  },
  cancelButtonText: { fontSize: fontSize.sm, fontWeight: '600', color: theme.textSecondary },
  saveButton: {
    flex: 1, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm,
    backgroundColor: theme.primary, alignItems: 'center',
  },
  saveButtonText: { fontSize: fontSize.sm, fontWeight: '700', color: theme.white },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: spacing.md, gap: spacing.sm, marginTop: spacing.sm,
  },
  addButtonText: { fontSize: fontSize.md, fontWeight: '600', color: theme.primary },
  lockedCard: {
    alignItems: 'center', padding: spacing.xl, backgroundColor: theme.surface,
    borderRadius: borderRadius.md, gap: spacing.md,
  },
  lockedText: { fontSize: fontSize.sm, color: theme.textSecondary, textAlign: 'center' },
  upgradeButton: {
    backgroundColor: theme.primary, borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  upgradeButtonText: { color: theme.white, fontWeight: '700', fontSize: fontSize.sm },
  matchStatsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  matchStatItem: { flex: 1, backgroundColor: theme.surface, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  matchStatNum: { fontSize: fontSize.xl, fontWeight: '800', color: theme.text },
  matchStatLabel: { fontSize: 10, color: theme.textSecondary, marginTop: 2 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: theme.white, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: 6, borderWidth: 1, borderColor: theme.border,
  },
  matchRowDate: { fontSize: fontSize.xs, color: theme.textSecondary, fontWeight: '500', width: 54 },
  matchRowOpponent: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: theme.text },
  matchRowPs: { fontSize: fontSize.xs, fontWeight: '700', color: theme.officialBadge },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  resultBadgeText: { fontSize: 11, fontWeight: '700', color: theme.white },
  moreStatsToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, marginTop: 2,
  },
  moreStatsToggleText: { fontSize: fontSize.sm, fontWeight: '700', color: theme.primary },
  moreStatsBox: {
    backgroundColor: theme.surface, borderRadius: borderRadius.sm,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  moreStatsHeading: { fontSize: fontSize.sm, fontWeight: '700', color: theme.text, marginBottom: spacing.xs },
  moreStatsHeaderRow: {
    flexDirection: 'row', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  moreStatsDataRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  moreStatsCell: { flex: 1, fontSize: fontSize.xs, color: theme.text, textAlign: 'center', fontWeight: '600' },
  moreStatsCellLabel: { flex: 1.4, textAlign: 'left', color: theme.textSecondary },
  moreStatsAvg: { fontSize: fontSize.sm, color: theme.text, fontWeight: '600' },
  moreMatchesBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, marginTop: 2, marginBottom: spacing.xs,
  },
  moreMatchesText: { fontSize: fontSize.sm, fontWeight: '700', color: theme.primary },
  tagGroupLabel: { fontSize: fontSize.xs, color: theme.textSecondary, fontWeight: '700', marginTop: spacing.xs },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  aggTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full,
  },
  aggTagGood: { backgroundColor: '#E8F5E9' },
  aggTagGoodText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  aggTagImprove: { backgroundColor: '#FFF3E0' },
  aggTagImproveText: { fontSize: 12, fontWeight: '700', color: '#E65100' },
  aggTagCount: { fontSize: 11, fontWeight: '800', color: theme.textSecondary },
});
