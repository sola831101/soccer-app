import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { updateTeamName } from '../../lib/firestore';
import { linkWithApple, linkWithGoogle, isAnonymous, getLinkedProviders, isAppleAvailable } from '../../lib/auth';

export default function SettingsScreen() {
  const { team, teamId, setTeamId, user } = useTeam();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(team?.name || '');
  const [copied, setCopied] = useState(false);
  const [linking, setLinking] = useState(false);

  const linkedProviders = getLinkedProviders(user);
  const isAppleLinked = linkedProviders.includes('apple.com');
  const isGoogleLinked = linkedProviders.includes('google.com');
  const hasAnyLink = isAppleLinked || isGoogleLinked;

  const handleLinkApple = async () => {
    if (!user || linking) return;
    setLinking(true);
    try {
      await linkWithApple(user);
      Alert.alert('完了', 'Appleアカウントと連携しました');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '連携に失敗しました';
      if (!msg.includes('cancelled')) {
        Alert.alert('エラー', msg);
      }
    } finally {
      setLinking(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!user || linking) return;
    setLinking(true);
    try {
      await linkWithGoogle(user);
      Alert.alert('完了', 'Googleアカウントと連携しました');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '連携に失敗しました';
      if (!msg.includes('cancelled')) {
        Alert.alert('エラー', msg);
      }
    } finally {
      setLinking(false);
    }
  };

  const handleCopyCode = async () => {
    if (!team) return;
    await Clipboard.setStringAsync(team.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = async () => {
    if (!teamId || !newName.trim()) return;
    try {
      await updateTeamName(teamId, newName.trim());
      setEditingName(false);
    } catch {
      Alert.alert('エラー', '名前の更新に失敗しました');
    }
  };

  const handleLeaveTeam = () => {
    Alert.alert(
      'チームを退出',
      'このチームから退出しますか？データは削除されません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            await setTeamId(null);
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  if (!team) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* チーム名 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>チーム名</Text>
        {editingName ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveName}>
              <Text style={styles.saveText}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingName(false); setNewName(team.name); }}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => { setNewName(team.name); setEditingName(true); }}
          >
            <Text style={styles.settingValue}>{team.name}</Text>
            <Ionicons name="pencil-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* 共有コード */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>共有コード</Text>
        <Text style={styles.codeDescription}>
          家族にこのコードを共有してください。アプリをインストールしてコードを入力するだけで参加できます。
        </Text>
        <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode}>
          <Text style={styles.codeText}>{team.shareCode}</Text>
          <View style={styles.copyButton}>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={20}
              color={copied ? theme.primary : theme.textSecondary}
            />
            <Text style={[styles.copyText, copied && { color: theme.primary }]}>
              {copied ? 'コピー済み' : 'コピー'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* メンバー */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>メンバー</Text>
        <View style={styles.settingRow}>
          <Ionicons name="people-outline" size={20} color={theme.textSecondary} />
          <Text style={styles.memberCount}>{team.memberIds.length}人が参加中</Text>
        </View>
      </View>

      {/* 選手管理 */}
      <TouchableOpacity
        style={styles.section}
        onPress={() => router.push('/players')}
      >
        <View style={styles.settingRow}>
          <Ionicons name="person-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>選手管理</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* 会場管理 */}
      <TouchableOpacity
        style={styles.section}
        onPress={() => router.push('/venues')}
      >
        <View style={styles.settingRow}>
          <Ionicons name="location-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>会場管理</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* チーム退出 */}
      <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveTeam}>
        <Ionicons name="log-out-outline" size={20} color={theme.danger} />
        <Text style={styles.leaveText}>チームから退出</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  settingValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: theme.text,
  },
  saveButton: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  saveText: {
    color: theme.white,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  cancelText: {
    color: theme.textSecondary,
    fontSize: fontSize.sm,
  },
  codeDescription: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: theme.primary,
    letterSpacing: 6,
    marginBottom: spacing.sm,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
  },
  memberCount: {
    fontSize: fontSize.md,
    color: theme.text,
    fontWeight: '500',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  leaveText: {
    color: theme.danger,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  accountDescription: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm + 4,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  authButtonLinked: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  authButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  authButtonTextLinked: {
    color: theme.primary,
  },
});
