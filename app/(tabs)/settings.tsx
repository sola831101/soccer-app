import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { updateTeamName } from '../../lib/firestore';
import { EmailLinkModal } from '../../components/EmailLinkModal';
import { PLAN_DISPLAY } from '../../lib/plans';
import Constants from 'expo-constants';

const FAQ_URL = 'https://sola831101.github.io/soccer-app/faq.html';

export default function SettingsScreen() {
  const { team, teamId, plan, isEmailLinked } = useTeam();
  const planDisplay = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(team?.name || '');
  const [showEmailLink, setShowEmailLink] = useState(false);

  const handleSaveName = async () => {
    if (!teamId || !newName.trim()) return;
    try {
      await updateTeamName(teamId, newName.trim());
      setEditingName(false);
    } catch {
      Alert.alert('エラー', '名前の更新に失敗しました');
    }
  };

  if (!team) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <EmailLinkModal
        visible={showEmailLink}
        onClose={() => setShowEmailLink(false)}
      />

      {!isEmailLinked && (
        <TouchableOpacity style={styles.emailBanner} onPress={() => setShowEmailLink(true)}>
          <Ionicons name="mail-outline" size={20} color="#E65100" />
          <View style={styles.emailBannerText}>
            <Text style={styles.emailBannerTitle}>メールアドレスを登録してください</Text>
            <Text style={styles.emailBannerSub}>機種変更・再インストール時にデータを引き継げます</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#E65100" />
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>グループ名</Text>
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

      <TouchableOpacity style={styles.section} onPress={() => router.push('/players')}>
        <View style={styles.settingRow}>
          <Ionicons name="person-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>選手情報</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.section} onPress={() => router.push('/venues')}>
        <View style={styles.settingRow}>
          <Ionicons name="location-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>会場管理</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.section} onPress={() => router.push('/settings/members')}>
        <View style={styles.settingRow}>
          <Ionicons name="people-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>グループメンバー・招待コード</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.section} onPress={() => router.push('/settings/plan')}>
        <View style={styles.settingRow}>
          <Ionicons name="star-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>プラン</Text>
          <View style={[styles.planBadge, { backgroundColor: planDisplay.color }]}>
            <Text style={styles.planBadgeText}>{planDisplay.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.section} onPress={() => Linking.openURL(FAQ_URL).catch(() => {})}>
        <View style={styles.settingRow}>
          <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>よくある質問</Text>
          <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      <Text style={styles.versionText}>バージョン {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  content: { padding: spacing.md },
  emailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    gap: spacing.sm,
  },
  emailBannerText: { flex: 1 },
  emailBannerTitle: { fontSize: fontSize.sm, fontWeight: '700', color: '#E65100' },
  emailBannerSub: { fontSize: fontSize.xs, color: '#BF360C', marginTop: 2 },
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
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  saveText: { color: theme.white, fontWeight: '600', fontSize: fontSize.sm },
  cancelText: { color: theme.textSecondary, fontSize: fontSize.sm },
  planBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  planBadgeText: { fontSize: fontSize.xs, fontWeight: '700', color: theme.white },
  versionText: {
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
