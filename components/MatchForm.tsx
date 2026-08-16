import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { MatchFormData, MatchType, MatchStatus, PeriodFormat, Venue, PlayerMatchStat, PlayInterval } from '../lib/types';
import { useTeam } from '../lib/context/TeamContext';
import { createVenue } from '../lib/firestore';

// 1ハーフの長さ（分）の選択範囲
const HALF_MIN = 5;
const HALF_MAX = 45;
const HALF_DEFAULT = 15;

// onSubmit で親に渡す選手スタッツのマップ型
export type PlayerStatsMap = {
  [pid: string]: {
    goals: number;
    assists: number;
    clears: number;
    intervals?: PlayInterval[];
    note?: string;
  };
};

// 出場区間の編集用ドラフト（前半/後半 × 開始/終了の指定）
type IntervalDraft = {
  half: 1 | 2;
  startKind: 'start' | 'min'; // 開始から or ○分から
  startMin: string;
  endKind: 'end' | 'min';     // 最後まで or ○分で交代
  endMin: string;
};
const makeHalf = (half: 1 | 2): IntervalDraft => ({
  half, startKind: 'start', startMin: '', endKind: 'end', endMin: '',
});

type StatDraft = {
  goals: number;
  assists: number;
  clears: number;
  fullTime: boolean;          // フル出場（前後半とも最後まで）
  intervals: IntervalDraft[];
  note: string;
};
const emptyStatDraft = (): StatDraft => ({
  goals: 0, assists: 0, clears: 0, fullTime: false, intervals: [], note: '',
});

// 保存済みスタッツ → 編集ドラフトへ変換（旧形式 in/out も読み込む）
function draftFromStat(s?: PlayerMatchStat): StatDraft {
  const intervals: IntervalDraft[] = (s?.intervals ?? []).map((iv): IntervalDraft => {
    if (iv.half == null && (iv.in != null || iv.out != null)) {
      return { half: 1, startKind: 'min', startMin: String(iv.in ?? 0), endKind: 'min', endMin: String(iv.out ?? 0) };
    }
    return {
      half: iv.half === 2 ? 2 : 1,
      startKind: iv.start === 'start' || iv.start == null ? 'start' : 'min',
      startMin: typeof iv.start === 'number' ? String(iv.start) : '',
      endKind: iv.end === 'end' || iv.end == null ? 'end' : 'min',
      endMin: typeof iv.end === 'number' ? String(iv.end) : '',
    };
  });
  // 前半フル＋後半フルの2区間ならフル出場として扱う
  const isFull =
    intervals.length === 2 &&
    intervals.some((d) => d.half === 1 && d.startKind === 'start' && d.endKind === 'end') &&
    intervals.some((d) => d.half === 2 && d.startKind === 'start' && d.endKind === 'end');
  return {
    goals: s?.goals ?? 0,
    assists: s?.assists ?? 0,
    clears: s?.clears ?? 0,
    fullTime: isFull,
    intervals,
    note: s?.note ?? '',
  };
}

interface Props {
  initialData?: Partial<MatchFormData>;
  initialPlayerStats?: { [pid: string]: PlayerMatchStat };
  onSubmit: (data: MatchFormData, playerStats: PlayerStatsMap | null) => void;
  onDelete?: () => void;
  isEditing?: boolean;
}

export function MatchForm({ initialData, initialPlayerStats, onSubmit, onDelete, isEditing }: Props) {
  const { venues, teamId, players, isPremium } = useTeam();
  const [date, setDate] = useState(initialData?.date || new Date());
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);
  const [opponent, setOpponent] = useState(initialData?.opponent || '');
  const [venue, setVenue] = useState(initialData?.venue || '');
  const [venueId, setVenueId] = useState<string | undefined>(initialData?.venueId);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [saveVenue, setSaveVenue] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [matchType, setMatchType] = useState<MatchType>(initialData?.matchType || 'practice');
  const [competitionName, setCompetitionName] = useState(initialData?.competitionName || '');
  const [scoreHome, setScoreHome] = useState(initialData?.scoreHome?.toString() || '');
  const [scoreAway, setScoreAway] = useState(initialData?.scoreAway?.toString() || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [youtubeUrl, setYoutubeUrl] = useState(initialData?.youtubeUrl || '');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(initialData?.playerIds ?? []);
  const [halfMinutes, setHalfMinutes] = useState<number>(initialData?.halfMinutes ?? HALF_DEFAULT);
  const [periodFormat, setPeriodFormat] = useState<PeriodFormat>(initialData?.periodFormat ?? 'halves');
  const [noResult, setNoResult] = useState<boolean>(initialData?.noResult ?? false);
  const [hasExtraTime, setHasExtraTime] = useState<boolean>(initialData?.etHome != null || initialData?.etAway != null);
  const [etHome, setEtHome] = useState(initialData?.etHome != null ? String(initialData.etHome) : '');
  const [etAway, setEtAway] = useState(initialData?.etAway != null ? String(initialData.etAway) : '');
  const [hasPk, setHasPk] = useState<boolean>(initialData?.pkHome != null || initialData?.pkAway != null);
  const [pkHome, setPkHome] = useState(initialData?.pkHome != null ? String(initialData.pkHome) : '');
  const [pkAway, setPkAway] = useState(initialData?.pkAway != null ? String(initialData.pkAway) : '');
  const [statsDraft, setStatsDraft] = useState<Record<string, StatDraft>>(() => {
    const d: Record<string, StatDraft> = {};
    for (const pid of initialData?.playerIds ?? []) {
      d[pid] = draftFromStat(initialPlayerStats?.[pid]);
    }
    return d;
  });

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
    // 初選択時にドラフトを用意（既存スタッツがあれば読み込む）
    setStatsDraft((prev) =>
      prev[playerId] ? prev : { ...prev, [playerId]: draftFromStat(initialPlayerStats?.[playerId]) }
    );
  };

  // ----- 選手スタッツ編集ハンドラ -----
  const getDraft = (pid: string): StatDraft => statsDraft[pid] ?? emptyStatDraft();
  const updateStatDraft = (pid: string, patch: Partial<StatDraft>) => {
    setStatsDraft((prev) => ({ ...prev, [pid]: { ...(prev[pid] ?? emptyStatDraft()), ...patch } }));
  };
  const adjustStat = (pid: string, key: 'goals' | 'assists' | 'clears', delta: number) => {
    const cur = getDraft(pid);
    updateStatDraft(pid, { [key]: Math.max(0, (cur[key] ?? 0) + delta) });
  };
  const toggleFullTime = (pid: string) => {
    const cur = getDraft(pid);
    updateStatDraft(pid, { fullTime: !cur.fullTime });
  };
  const addInterval = (pid: string) => {
    const cur = getDraft(pid);
    // 1本形式は常に前半(=1)扱い。前後半は前半→後半の順で足す
    const half: 1 | 2 = periodFormat === 'single' ? 1 : cur.intervals.some((iv) => iv.half === 1) ? 2 : 1;
    updateStatDraft(pid, { intervals: [...cur.intervals, makeHalf(half)] });
  };
  const removeInterval = (pid: string, idx: number) => {
    const cur = getDraft(pid);
    updateStatDraft(pid, { intervals: cur.intervals.filter((_, i) => i !== idx) });
  };
  const setIntervalField = (pid: string, idx: number, patch: Partial<IntervalDraft>) => {
    const cur = getDraft(pid);
    const next = cur.intervals.map((iv, i) => (i === idx ? { ...iv, ...patch } : iv));
    updateStatDraft(pid, { intervals: next });
  };

  // ドラフト → 保存用スタッツマップ
  const buildPlayerStats = (): PlayerStatsMap => {
    const clean: PlayerStatsMap = {};
    for (const pid of selectedPlayerIds) {
      const v = statsDraft[pid];
      if (!v) continue;
      let intervals: PlayInterval[] = [];
      if (v.fullTime) {
        // フル出場：前後半なら前半+後半、1本なら1区間
        intervals = periodFormat === 'single'
          ? [{ half: 1, start: 'start', end: 'end' }]
          : [
              { half: 1, start: 'start', end: 'end' },
              { half: 2, start: 'start', end: 'end' },
            ];
      } else {
        for (const d of v.intervals) {
          const startN = d.startKind === 'start' ? 0 : parseInt(d.startMin, 10);
          const endN = d.endKind === 'end' ? halfMinutes : parseInt(d.endMin, 10);
          if (d.startKind === 'min' && isNaN(startN)) continue;
          if (d.endKind === 'min' && isNaN(endN)) continue;
          if (!(endN > startN)) continue;
          intervals.push({
            half: d.half,
            start: d.startKind === 'start' ? 'start' : startN,
            end: d.endKind === 'end' ? 'end' : endN,
          });
        }
      }
      const note = v.note.trim();
      const hasAny =
        v.goals > 0 || v.assists > 0 || v.clears > 0 ||
        intervals.length > 0 || note;
      if (!hasAny) continue;
      clean[pid] = {
        goals: v.goals,
        assists: v.assists,
        clears: v.clears,
        ...(intervals.length ? { intervals } : {}),
        ...(note ? { note } : {}),
      };
    }
    return clean;
  };

  // ステータスは日付から自動判定
  const status: MatchStatus = date < new Date() ? 'completed' : 'upcoming';

  const handleSubmit = async () => {
    if (!opponent.trim()) {
      Alert.alert('入力エラー', '対戦相手を入力してください');
      return;
    }
    if (!venue.trim()) {
      Alert.alert('入力エラー', '会場を入力してください');
      return;
    }

    // 会場を保存する場合
    let savedVenueId = venueId;
    if (saveVenue && teamId && !venueId) {
      try {
        const newVenue = await createVenue(teamId, {
          name: venue.trim(),
          googleMapsUrl: googleMapsUrl.trim() || undefined,
        });
        savedVenueId = newVenue.id;
      } catch {
        // 保存失敗しても試合登録は続行
      }
    }

    // スコアをパース（空/NaN は null）
    const num = (s: string): number | null => {
      if (s === '') return null;
      const n = parseInt(s, 10);
      return isNaN(n) ? null : n;
    };
    // 勝敗を記録しない試合はスコア/延長/PKを持たせない
    const parsedHome = noResult ? null : num(scoreHome);
    const parsedAway = noResult ? null : num(scoreAway);
    const useEt = !noResult && hasExtraTime;
    const usePk = !noResult && hasPk;

    const formData: MatchFormData = {
      date,
      opponent: opponent.trim(),
      venue: venue.trim(),
      venueId: savedVenueId,
      matchType,
      competitionName: matchType !== 'practice' ? competitionName.trim() || undefined : undefined,
      scoreHome: parsedHome,
      scoreAway: parsedAway,
      etHome: useEt ? num(etHome) : null,
      etAway: useEt ? num(etAway) : null,
      pkHome: usePk ? num(pkHome) : null,
      pkAway: usePk ? num(pkAway) : null,
      noResult,
      periodFormat,
      notes: notes.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      status,
      halfMinutes,
      playerIds: selectedPlayerIds,
    };

    const stats = isPremium ? buildPlayerStats() : null;
    onSubmit(formData, stats);
  };

  const selectVenue = (v: Venue) => {
    setVenue(v.name);
    setVenueId(v.id);
    if (v.googleMapsUrl) setGoogleMapsUrl(v.googleMapsUrl);
    setSaveVenue(false);
    setShowVenueModal(false);
  };

  const handleOpenGoogleMaps = () => {
    Linking.openURL('https://maps.google.com');
  };

  const clearVenueSelection = () => {
    setVenueId(undefined);
    setGoogleMapsUrl('');
  };

  const onAndroidDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(newDate);
      setAndroidPickerMode('time');
    } else {
      setAndroidPickerMode(null);
    }
  };

  const onAndroidTimeChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    setAndroidPickerMode(null);
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setDate(newDate);
    }
  };

  const formatDateStr = (d: Date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  const formatTimeStr = (d: Date) => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* 日時 */}
        <Text style={styles.label}>日時</Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={date}
            mode="datetime"
            display="inline"
            onChange={(_, selectedDate) => {
              if (selectedDate) setDate(selectedDate);
            }}
            locale="ja"
            minuteInterval={5}
            style={{ marginBottom: spacing.sm }}
          />
        ) : (
          <>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setAndroidPickerMode('date')}>
                <Text style={styles.dateText}>{formatDateStr(date)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateButton} onPress={() => setAndroidPickerMode('time')}>
                <Text style={styles.dateText}>{formatTimeStr(date)}</Text>
              </TouchableOpacity>
            </View>
            {androidPickerMode === 'date' && (
              <DateTimePicker value={date} mode="date" onChange={onAndroidDateChange} locale="ja" />
            )}
            {androidPickerMode === 'time' && (
              <DateTimePicker value={date} mode="time" onChange={onAndroidTimeChange} locale="ja" minuteInterval={5} />
            )}
          </>
        )}

        {/* 対戦相手 */}
        <Text style={styles.label}>対戦相手 *</Text>
        <TextInput
          style={styles.input}
          value={opponent}
          onChangeText={setOpponent}
          placeholder="チーム名を入力"
          placeholderTextColor={theme.textSecondary}
        />

        {/* 会場 */}
        <Text style={styles.label}>会場 *</Text>
        <View style={styles.venueRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={venue}
            onChangeText={(text) => {
              setVenue(text);
              if (venueId) clearVenueSelection();
            }}
            placeholder="会場名を入力"
            placeholderTextColor={theme.textSecondary}
          />
          {venues.length > 0 && (
            <TouchableOpacity style={styles.venueButton} onPress={() => setShowVenueModal(true)}>
              <Ionicons name="list-outline" size={20} color={theme.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* 選択中の会場情報 */}
        {venueId && googleMapsUrl ? (
          <TouchableOpacity
            style={styles.mapsLink}
            onPress={() => Linking.openURL(googleMapsUrl)}
          >
            <Ionicons name="location" size={16} color={theme.primary} />
            <Text style={styles.mapsLinkText}>Google Maps で開く</Text>
          </TouchableOpacity>
        ) : null}

        {/* 会場を保存するチェック（新規入力時のみ） */}
        {!venueId && venue.trim().length > 0 && (
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setSaveVenue(!saveVenue)}
          >
            <Ionicons
              name={saveVenue ? 'checkbox' : 'square-outline'}
              size={22}
              color={saveVenue ? theme.primary : theme.textSecondary}
            />
            <Text style={styles.checkboxLabel}>この会場を保存する</Text>
          </TouchableOpacity>
        )}

        {/* Google Maps URL（保存する場合のみ表示） */}
        {saveVenue && !venueId && (
          <>
            <TextInput
              style={[styles.input, { marginTop: spacing.xs }]}
              value={googleMapsUrl}
              onChangeText={setGoogleMapsUrl}
              placeholder="Google Maps URL（任意）"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={styles.openMapsBtn} onPress={handleOpenGoogleMaps}>
              <Ionicons name="map-outline" size={16} color={theme.primary} />
              <Text style={styles.openMapsBtnText}>Google Maps を開いてURLを取得</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 試合種別 */}
        <Text style={styles.label}>試合種別</Text>
        <View style={styles.segmentRow}>
          {([
            { key: 'official', label: '公式戦', active: styles.segmentActiveBlue },
            { key: 'sub_official', label: 'サブ公式戦', active: styles.segmentActiveTeal },
            { key: 'practice', label: '練習試合', active: styles.segmentActiveOrange },
          ] as const).map((seg) => {
            const on = matchType === seg.key;
            return (
              <TouchableOpacity
                key={seg.key}
                style={[styles.segment, on && seg.active]}
                onPress={() => setMatchType(seg.key)}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextActive]}>{seg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 大会名（公式戦・サブ公式戦） */}
        {matchType !== 'practice' && (
          <>
            <Text style={styles.label}>大会名</Text>
            <TextInput
              style={styles.input}
              value={competitionName}
              onChangeText={setCompetitionName}
              placeholder="例: ○○リーグ 2026 / △△カップ"
              placeholderTextColor={theme.textSecondary}
            />
          </>
        )}

        {/* ステータス（自動判定） */}
        <View style={styles.statusInfo}>
          <Ionicons
            name={status === 'completed' ? 'checkmark-circle' : 'time-outline'}
            size={18}
            color={status === 'completed' ? theme.primary : theme.textSecondary}
          />
          <Text style={styles.statusInfoText}>
            {status === 'completed' ? '過去の試合 — スコアを入力できます' : '予定の試合'}
          </Text>
        </View>

        {/* スコア・結果 */}
        {status === 'completed' && (
          <>
            <Text style={styles.label}>スコア・結果</Text>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setNoResult((v) => !v)}>
              <Ionicons
                name={noResult ? 'checkbox' : 'square-outline'}
                size={22}
                color={noResult ? theme.primary : theme.textSecondary}
              />
              <Text style={styles.checkboxLabel}>勝敗を記録しない（スコアなしで登録）</Text>
            </TouchableOpacity>

            {!noResult && (
              <>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreInput}>
                    <Text style={styles.scoreLabel}>自チーム</Text>
                    <TextInput
                      style={styles.scoreField}
                      value={scoreHome}
                      onChangeText={setScoreHome}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#CCCCCC"
                      textAlign="center"
                    />
                  </View>
                  <Text style={styles.scoreSeparator}>-</Text>
                  <View style={styles.scoreInput}>
                    <Text style={styles.scoreLabel}>相手</Text>
                    <TextInput
                      style={styles.scoreField}
                      value={scoreAway}
                      onChangeText={setScoreAway}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#CCCCCC"
                      textAlign="center"
                    />
                  </View>
                </View>

                {/* 延長戦 */}
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasExtraTime((v) => !v)}>
                  <Ionicons
                    name={hasExtraTime ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={hasExtraTime ? theme.primary : theme.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>延長戦あり</Text>
                </TouchableOpacity>
                {hasExtraTime && (
                  <View style={styles.subScoreRow}>
                    <Text style={styles.subScoreLabel}>延長</Text>
                    <TextInput
                      style={styles.subScoreField}
                      value={etHome}
                      onChangeText={setEtHome}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#CCCCCC"
                      textAlign="center"
                    />
                    <Text style={styles.subScoreSep}>-</Text>
                    <TextInput
                      style={styles.subScoreField}
                      value={etAway}
                      onChangeText={setEtAway}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#CCCCCC"
                      textAlign="center"
                    />
                  </View>
                )}

                {/* PK戦 */}
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasPk((v) => !v)}>
                  <Ionicons
                    name={hasPk ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={hasPk ? theme.primary : theme.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>PK戦あり</Text>
                </TouchableOpacity>
                {hasPk && (
                  <View style={styles.subScoreRow}>
                    <Text style={styles.subScoreLabel}>PK</Text>
                    <TextInput
                      style={styles.subScoreField}
                      value={pkHome}
                      onChangeText={setPkHome}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#CCCCCC"
                      textAlign="center"
                    />
                    <Text style={styles.subScoreSep}>-</Text>
                    <TextInput
                      style={styles.subScoreField}
                      value={pkAway}
                      onChangeText={setPkAway}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#CCCCCC"
                      textAlign="center"
                    />
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* 試合形式 */}
        <Text style={styles.label}>試合形式</Text>
        <View style={styles.segmentRow}>
          {([
            { key: 'halves', label: '前後半' },
            { key: 'single', label: '1本（単一ピリオド）' },
          ] as const).map((f) => {
            const on = periodFormat === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.segment, on && styles.segmentActiveGreen]}
                onPress={() => setPeriodFormat(f.key)}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 1ハーフ/1本の長さ */}
        <Text style={styles.label}>{periodFormat === 'single' ? '試合時間' : '1ハーフの長さ'}</Text>
        <View style={styles.halfStepRow}>
          <TouchableOpacity
            style={styles.halfStepBtn}
            onPress={() => setHalfMinutes((v) => Math.max(HALF_MIN, v - 1))}
          >
            <Ionicons name="remove" size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.halfStepValue}>{halfMinutes}分</Text>
          <TouchableOpacity
            style={styles.halfStepBtn}
            onPress={() => setHalfMinutes((v) => Math.min(HALF_MAX, v + 1))}
          >
            <Ionicons name="add" size={20} color={theme.primary} />
          </TouchableOpacity>
          {periodFormat !== 'single' && <Text style={styles.halfStepHint}>ハーフ</Text>}
        </View>

        {/* 出場選手 */}
        {players.length > 0 && (
          <>
            <Text style={styles.label}>出場選手</Text>
            <View style={styles.playerChipsRow}>
              {players.map((p) => {
                const selected = selectedPlayerIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playerChip, selected && styles.playerChipSelected]}
                    onPress={() => togglePlayer(p.id)}
                  >
                    <Text style={[styles.playerChipText, selected && styles.playerChipTextSelected]}>
                      {p.number != null ? `#${p.number} ` : ''}{p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 選手スタッツ（ファミリープラン・完了した試合のみ） */}
        {isPremium && status === 'completed' && selectedPlayerIds.length > 0 && (
          <>
            <Text style={styles.label}>選手スタッツ</Text>
            <View style={styles.statsCard}>
              {selectedPlayerIds.map((pid) => {
                const p = players.find((pl) => pl.id === pid);
                if (!p) return null;
                const d = getDraft(pid);
                return (
                  <View key={pid} style={styles.statEditBlock}>
                    <Text style={styles.statPlayerName} numberOfLines={1}>
                      {p.number != null ? `#${p.number}  ` : ''}{p.name}
                    </Text>

                    {/* 得点・アシスト・ブロック */}
                    {([
                      { key: 'goals' as const, icon: 'football' as const, label: '得点' },
                      { key: 'assists' as const, icon: 'flash' as const, label: 'アシスト' },
                      { key: 'clears' as const, icon: 'shield' as const, label: 'ブロック' },
                    ]).map((row) => (
                      <View key={row.key} style={styles.statRow}>
                        <View style={styles.statRowLabel}>
                          <Ionicons name={row.icon} size={16} color={theme.officialBadge} />
                          <Text style={styles.statRowLabelText}>{row.label}</Text>
                        </View>
                        <View style={styles.stepperControls}>
                          <TouchableOpacity style={styles.stepBtn} onPress={() => adjustStat(pid, row.key, -1)}>
                            <Ionicons name="remove" size={18} color={theme.primary} />
                          </TouchableOpacity>
                          <Text style={styles.stepVal}>{d[row.key]}</Text>
                          <TouchableOpacity style={styles.stepBtn} onPress={() => adjustStat(pid, row.key, 1)}>
                            <Ionicons name="add" size={18} color={theme.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {/* 出場時間 */}
                    <View style={styles.subBlock}>
                      <Text style={styles.subBlockLabel}>出場時間</Text>
                      <TouchableOpacity style={styles.fullTimeRow} onPress={() => toggleFullTime(pid)}>
                        <Ionicons
                          name={d.fullTime ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={d.fullTime ? theme.primary : theme.textSecondary}
                        />
                        <Text style={styles.fullTimeLabel}>
                          {periodFormat === 'single' ? 'フル出場（最後まで）' : 'フル出場（前後半とも最後まで）'}
                        </Text>
                      </TouchableOpacity>

                      {!d.fullTime && (
                        <>
                          {d.intervals.map((iv, i) => (
                            <View key={i} style={styles.ivCard}>
                              <View style={styles.ivCardHead}>
                                {periodFormat === 'single' ? (
                                  <Text style={styles.ivSingleLabel}>出場区間</Text>
                                ) : (
                                  <View style={styles.segRow}>
                                    {([1, 2] as const).map((h) => {
                                      const on = iv.half === h;
                                      return (
                                        <TouchableOpacity
                                          key={h}
                                          style={[styles.segBtn, on && styles.segBtnOn]}
                                          onPress={() => setIntervalField(pid, i, { half: h })}
                                        >
                                          <Text style={[styles.segBtnText, on && styles.segBtnTextOn]}>
                                            {h === 1 ? '前半' : '後半'}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                )}
                                <TouchableOpacity onPress={() => removeInterval(pid, i)} style={styles.ivRemove}>
                                  <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                </TouchableOpacity>
                              </View>

                              <View style={styles.ivBody}>
                                {/* 開始 */}
                                <TouchableOpacity
                                  style={[styles.ivOpt, iv.startKind === 'start' && styles.ivOptOn]}
                                  onPress={() => setIntervalField(pid, i, { startKind: 'start' })}
                                >
                                  <Text style={[styles.ivOptText, iv.startKind === 'start' && styles.ivOptTextOn]}>
                                    {iv.half === 2 ? '最初から' : 'スタメン'}
                                  </Text>
                                </TouchableOpacity>
                                <View style={styles.ivMinGroup}>
                                  <TouchableOpacity
                                    style={[styles.ivOpt, iv.startKind === 'min' && styles.ivOptOn]}
                                    onPress={() => setIntervalField(pid, i, { startKind: 'min' })}
                                  >
                                    <Text style={[styles.ivOptText, iv.startKind === 'min' && styles.ivOptTextOn]}>途中出場</Text>
                                  </TouchableOpacity>
                                  {iv.startKind === 'min' && (
                                    <View style={styles.ivMinWrap}>
                                      <TextInput
                                        style={styles.ivMinInput}
                                        value={iv.startMin}
                                        onChangeText={(t) => setIntervalField(pid, i, { startMin: t.replace(/[^0-9]/g, '') })}
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor={theme.textSecondary}
                                      />
                                      <Text style={styles.ivMinUnit}>分</Text>
                                    </View>
                                  )}
                                </View>

                                <Text style={styles.ivTilde}>〜</Text>

                                {/* 終了 */}
                                <TouchableOpacity
                                  style={[styles.ivOpt, iv.endKind === 'end' && styles.ivOptOn]}
                                  onPress={() => setIntervalField(pid, i, { endKind: 'end' })}
                                >
                                  <Text style={[styles.ivOptText, iv.endKind === 'end' && styles.ivOptTextOn]}>最後まで</Text>
                                </TouchableOpacity>
                                <View style={styles.ivMinGroup}>
                                  <TouchableOpacity
                                    style={[styles.ivOpt, iv.endKind === 'min' && styles.ivOptOn]}
                                    onPress={() => setIntervalField(pid, i, { endKind: 'min' })}
                                  >
                                    <Text style={[styles.ivOptText, iv.endKind === 'min' && styles.ivOptTextOn]}>途中で交代</Text>
                                  </TouchableOpacity>
                                  {iv.endKind === 'min' && (
                                    <View style={styles.ivMinWrap}>
                                      <TextInput
                                        style={styles.ivMinInput}
                                        value={iv.endMin}
                                        onChangeText={(t) => setIntervalField(pid, i, { endMin: t.replace(/[^0-9]/g, '') })}
                                        keyboardType="number-pad"
                                        placeholder={String(halfMinutes)}
                                        placeholderTextColor={theme.textSecondary}
                                      />
                                      <Text style={styles.ivMinUnit}>分</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          ))}
                          <TouchableOpacity style={styles.addIntervalBtn} onPress={() => addInterval(pid)}>
                            <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
                            <Text style={styles.addIntervalText}>出場区間を追加</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>

                    {/* メモ */}
                    <TextInput
                      style={styles.statNoteInput}
                      value={d.note}
                      onChangeText={(t) => updateStatDraft(pid, { note: t })}
                      placeholder="メモ（任意）例: PK決めた / 後半から出場"
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* YouTube URL */}
        <Text style={styles.label}>YouTube URL</Text>
        <TextInput
          style={styles.input}
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          placeholder="https://youtube.com/watch?v=..."
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* メモ */}
        <Text style={styles.label}>メモ</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="試合のメモを入力..."
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* 保存ボタン */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>{isEditing ? '更新する' : '登録する'}</Text>
        </TouchableOpacity>

        {/* 削除ボタン */}
        {isEditing && onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert('確認', 'この試合を削除しますか？', [
                { text: 'キャンセル', style: 'cancel' },
                { text: '削除', style: 'destructive', onPress: onDelete },
              ]);
            }}
          >
            <Text style={styles.deleteText}>この試合を削除</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 保存済み会場モーダル */}
      <Modal visible={showVenueModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>保存済み会場</Text>
              <TouchableOpacity onPress={() => setShowVenueModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={venues}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.venueItem} onPress={() => selectVenue(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.venueItemName}>{item.name}</Text>
                    {item.address && (
                      <Text style={styles.venueItemAddress}>{item.address}</Text>
                    )}
                  </View>
                  {item.googleMapsUrl && (
                    <Ionicons name="location" size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyVenue}>保存済みの会場はありません</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 4,
    fontSize: fontSize.md,
    color: theme.text,
    backgroundColor: theme.white,
  },
  textArea: {
    minHeight: 100,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 4,
    backgroundColor: theme.white,
  },
  dateText: {
    fontSize: fontSize.md,
    color: theme.text,
    textAlign: 'center',
  },
  venueRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  venueButton: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  mapsLinkText: {
    fontSize: fontSize.sm,
    color: theme.primary,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  checkboxLabel: {
    fontSize: fontSize.sm,
    color: theme.text,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.white,
  },
  segmentActiveOrange: {
    backgroundColor: theme.practiceBadge,
    borderColor: theme.practiceBadge,
  },
  segmentActiveBlue: {
    backgroundColor: theme.officialBadge,
    borderColor: theme.officialBadge,
  },
  segmentActiveGreen: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  segmentActiveTeal: {
    backgroundColor: theme.subOfficialBadge,
    borderColor: theme.subOfficialBadge,
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  segmentTextActive: {
    color: theme.white,
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  openMapsBtnText: {
    fontSize: fontSize.sm,
    color: theme.primary,
    fontWeight: '600',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.sm,
  },
  statusInfoText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  scoreInput: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginBottom: spacing.xs,
  },
  scoreField: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    width: 80,
    height: 50,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text,
    backgroundColor: theme.white,
  },
  scoreSeparator: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.textSecondary,
    marginTop: 20,
  },
  subScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  subScoreLabel: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  subScoreField: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    width: 56,
    height: 40,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
    backgroundColor: theme.white,
  },
  subScoreSep: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  ivSingleLabel: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitText: {
    color: theme.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  deleteText: {
    color: theme.danger,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '60%',
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
  },
  venueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  venueItemName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.text,
  },
  venueItemAddress: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },
  emptyVenue: {
    textAlign: 'center',
    color: theme.textSecondary,
    paddingVertical: spacing.lg,
    fontSize: fontSize.sm,
  },
  playerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  playerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.white,
  },
  playerChipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  playerChipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  playerChipTextSelected: {
    color: theme.white,
  },
  // 1ハーフの長さ ステッパー
  halfStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  halfStepBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfStepValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
    minWidth: 56,
    textAlign: 'center',
  },
  halfStepHint: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
  },
  // 選手スタッツ編集
  statsCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statEditBlock: {
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  statPlayerName: {
    fontSize: fontSize.md,
    color: theme.text,
    marginBottom: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statRowLabelText: {
    fontSize: fontSize.md,
    color: theme.text,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: theme.text,
    minWidth: 28,
    textAlign: 'center',
  },
  subBlock: {
    marginTop: spacing.sm,
  },
  subBlockLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text,
    marginBottom: spacing.xs,
  },
  fullTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fullTimeLabel: {
    fontSize: fontSize.sm,
    color: theme.text,
  },
  ivCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: theme.white,
  },
  ivCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  segRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  segBtnOn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  segBtnText: {
    fontSize: fontSize.sm,
    color: theme.text,
  },
  segBtnTextOn: {
    color: theme.white,
    fontWeight: '700',
  },
  ivRemove: {
    padding: 2,
  },
  ivBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ivMinGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ivOpt: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  ivOptOn: {
    backgroundColor: '#E8F5E9',
    borderColor: theme.primary,
  },
  ivOptText: {
    fontSize: fontSize.sm,
    color: theme.text,
  },
  ivOptTextOn: {
    color: theme.primary,
    fontWeight: '700',
  },
  ivMinWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ivMinInput: {
    width: 48,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm - 3,
    fontSize: fontSize.sm,
    color: theme.text,
    backgroundColor: theme.white,
    textAlign: 'center',
  },
  ivMinUnit: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
  },
  ivTilde: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginHorizontal: 2,
  },
  addIntervalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  addIntervalText: {
    fontSize: fontSize.sm,
    color: theme.primary,
    fontWeight: '600',
  },
  statNoteInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: theme.text,
    backgroundColor: theme.white,
    marginTop: spacing.sm,
    minHeight: 64,
    textAlign: 'left',
  },
});
