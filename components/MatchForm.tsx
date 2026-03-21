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
import { MatchFormData, MatchType, MatchStatus, Venue } from '../lib/types';
import { useTeam } from '../lib/context/TeamContext';
import { createVenue } from '../lib/firestore';

interface Props {
  initialData?: Partial<MatchFormData>;
  onSubmit: (data: MatchFormData) => void;
  onDelete?: () => void;
  isEditing?: boolean;
}

export function MatchForm({ initialData, onSubmit, onDelete, isEditing }: Props) {
  const { venues, teamId } = useTeam();
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

    // スコアをパースし、NaN対策
    const parsedHome = scoreHome !== '' ? parseInt(scoreHome, 10) : null;
    const parsedAway = scoreAway !== '' ? parseInt(scoreAway, 10) : null;

    const formData: MatchFormData = {
      date,
      opponent: opponent.trim(),
      venue: venue.trim(),
      venueId: savedVenueId,
      matchType,
      competitionName: matchType === 'official' ? competitionName.trim() : undefined,
      scoreHome: parsedHome !== null && !isNaN(parsedHome) ? parsedHome : null,
      scoreAway: parsedAway !== null && !isNaN(parsedAway) ? parsedAway : null,
      notes: notes.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      status,
    };

    onSubmit(formData);
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
          <TouchableOpacity
            style={[styles.segment, matchType === 'practice' && styles.segmentActiveOrange]}
            onPress={() => setMatchType('practice')}
          >
            <Text style={[styles.segmentText, matchType === 'practice' && styles.segmentTextActive]}>
              練習試合
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, matchType === 'official' && styles.segmentActiveBlue]}
            onPress={() => setMatchType('official')}
          >
            <Text style={[styles.segmentText, matchType === 'official' && styles.segmentTextActive]}>
              公式戦
            </Text>
          </TouchableOpacity>
        </View>

        {/* 大会名 */}
        {matchType === 'official' && (
          <>
            <Text style={styles.label}>大会名</Text>
            <TextInput
              style={styles.input}
              value={competitionName}
              onChangeText={setCompetitionName}
              placeholder="例: ○○リーグ 2026"
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

        {/* スコア */}
        {status === 'completed' && (
          <>
            <Text style={styles.label}>スコア</Text>
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
});
