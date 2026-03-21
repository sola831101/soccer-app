import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { useTeam } from '../lib/context/TeamContext';
import { createPlayer, deletePlayer } from '../lib/firestore';
import { Player, PlayerPosition } from '../lib/types';

interface PositionGroup {
  label: string;
  positions: { value: PlayerPosition; label: string; color: string }[];
}

const POSITION_GROUPS: PositionGroup[] = [
  {
    label: 'GK',
    positions: [
      { value: 'GK', label: 'GK', color: '#FF9800' },
    ],
  },
  {
    label: 'DF',
    positions: [
      { value: 'CB', label: 'CB', color: '#2196F3' },
      { value: 'RSB', label: '右SB', color: '#2196F3' },
      { value: 'LSB', label: '左SB', color: '#2196F3' },
    ],
  },
  {
    label: 'MF',
    positions: [
      { value: 'ボランチ', label: 'ボランチ', color: '#4CAF50' },
      { value: 'CMF', label: 'CMF', color: '#4CAF50' },
      { value: 'トップ下', label: 'トップ下', color: '#4CAF50' },
      { value: 'RSH', label: '右SH', color: '#4CAF50' },
      { value: 'LSH', label: '左SH', color: '#4CAF50' },
    ],
  },
  {
    label: 'FW',
    positions: [
      { value: 'RWG', label: '右WG', color: '#F44336' },
      { value: 'LWG', label: '左WG', color: '#F44336' },
      { value: 'CF', label: 'CF', color: '#F44336' },
    ],
  },
];

const ALL_POSITIONS = POSITION_GROUPS.flatMap((g) => g.positions);

function getPositionColor(pos: PlayerPosition): string {
  return ALL_POSITIONS.find((p) => p.value === pos)?.color || '#757575';
}

function getPositionLabel(pos: PlayerPosition): string {
  return ALL_POSITIONS.find((p) => p.value === pos)?.label || pos;
}

export default function PlayersScreen() {
  const { players, teamId } = useTeam();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<PlayerPosition[]>([]);
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const togglePosition = (pos: PlayerPosition) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('入力エラー', '選手名を入力してください');
      return;
    }
    if (selectedPositions.length === 0) {
      Alert.alert('入力エラー', 'ポジションを1つ以上選んでください');
      return;
    }
    if (!teamId) return;

    setSaving(true);
    try {
      await createPlayer(teamId, {
        name: name.trim(),
        positions: selectedPositions,
        number: number ? parseInt(number, 10) : undefined,
      });
      setName('');
      setSelectedPositions([]);
      setNumber('');
      setShowForm(false);
    } catch {
      Alert.alert('エラー', '選手の登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (player: Player) => {
    if (!teamId) return;
    Alert.alert('確認', `「${player.name}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => deletePlayer(teamId, player.id),
      },
    ]);
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const positions = item.positions || [];
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName}>{item.name}</Text>
            {item.number != null && (
              <Text style={styles.playerNumber}>#{item.number}</Text>
            )}
          </View>
          <View style={styles.positionTags}>
            {positions.map((pos) => (
              <View key={pos} style={[styles.positionTag, { backgroundColor: getPositionColor(pos) }]}>
                <Text style={styles.positionTagText}>{getPositionLabel(pos)}</Text>
              </View>
            ))}
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayer}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.border} />
            <Text style={styles.emptyText}>選手が登録されていません</Text>
            <Text style={styles.emptySubText}>
              お子さんの名前とポジションを{'\n'}登録しましょう
            </Text>
          </View>
        }
        ListFooterComponent={
          showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>選手を追加</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="名前 *"
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              <TextInput
                style={[styles.input, { marginTop: spacing.sm }]}
                value={number}
                onChangeText={setNumber}
                placeholder="背番号（任意）"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
              <Text style={styles.formLabel}>ポジション（複数選択可）</Text>
              {POSITION_GROUPS.map((group) => (
                <View key={group.label} style={styles.positionGroupContainer}>
                  <Text style={styles.positionGroupLabel}>{group.label}</Text>
                  <View style={styles.positionRow}>
                    {group.positions.map((pos) => {
                      const isSelected = selectedPositions.includes(pos.value);
                      return (
                        <TouchableOpacity
                          key={pos.value}
                          style={[
                            styles.positionOption,
                            isSelected && { backgroundColor: pos.color, borderColor: pos.color },
                          ]}
                          onPress={() => togglePosition(pos.value)}
                        >
                          <Text
                            style={[
                              styles.positionOptionText,
                              isSelected && { color: theme.white },
                            ]}
                          >
                            {pos.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowForm(false);
                    setName('');
                    setSelectedPositions([]);
                    setNumber('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && { opacity: 0.6 }]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? '保存中...' : '保存'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowForm(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
              <Text style={styles.addButtonText}>選手を追加</Text>
            </TouchableOpacity>
          )
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  list: {
    padding: spacing.md,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playerName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
  },
  playerNumber: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  positionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  positionTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  positionTagText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: theme.white,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: spacing.md,
  },
  emptySubText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.primary,
  },
  formCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  formTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
  positionGroupContainer: {
    marginBottom: spacing.sm,
  },
  positionGroupLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: spacing.xs,
  },
  positionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  positionOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.white,
  },
  positionOptionText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  formButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: theme.white,
  },
});
