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
import * as Clipboard from 'expo-clipboard';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { updateTeamName, updateTeamPlan } from '../../lib/firestore';
import { UpgradeModal } from '../../components/UpgradeModal';
import { EmailLinkModal } from '../../components/EmailLinkModal';
import { PLAN_LIMITS, PLAN_DISPLAY } from '../../lib/plans';

export default function SettingsScreen() {
  const { team, teamId, setTeamId, user, isPremium, plan, matches, venues, players, memberCount, isEmailLinked } = useTeam();
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const planDisplay = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(team?.name || '');
  const [copied, setCopied] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showEmailLink, setShowEmailLink] = useState(false);

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

  const isAdmin = user?.uid === team.createdBy;
  const now = new Date();
  const matchesThisMonth = matches.filter((m) => {
    const d = m.date.toDate();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => setShowUpgrade(false)}
      />
      <EmailLinkModal
        visible={showEmailLink}
        onClose={() => setShowEmailLink(false)}
      />

      {/* メール未登録バナー */}
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

      {/* 1. グループ名 */}
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

      {/* 2. 選手情報 */}
      <TouchableOpacity style={styles.section} onPress={() => router.push('/players')}>
        <View style={styles.settingRow}>
          <Ionicons name="person-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>選手情報</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* 3. 会場管理 */}
      <TouchableOpacity style={styles.section} onPress={() => router.push('/venues')}>
        <View style={styles.settingRow}>
          <Ionicons name="location-outline" size={20} color={theme.primary} />
          <Text style={[styles.settingValue, { marginLeft: spacing.sm }]}>会場管理</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* 4. メンバー */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>メンバー</Text>
        <View style={styles.settingRow}>
          <Ionicons name="people-outline" size={20} color={theme.textSecondary} />
          <Text style={styles.memberCount}>{memberCount}人が参加中</Text>
        </View>
        {isAdmin && (
          <>
            <Text style={[styles.codeDescription, { marginTop: spacing.md }]}>
              招待コードを共有してメンバーを招待できます。
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
          </>
        )}
      </View>

      {/* 6. プラン（管理者のみ） */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プラン</Text>
          <View style={styles.planRow}>
            <View style={[styles.planBadge, { backgroundColor: planDisplay.color }]}>
              <Text style={styles.planBadgeText}>{planDisplay.label}</Text>
            </View>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>試合（今月）</Text>
            <Text style={styles.usageValue}>
              {matchesThisMonth.length} / {planLimits.matchesPerMonth === Infinity ? '無制限' : `${planLimits.matchesPerMonth}件`}
            </Text>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>選手</Text>
            <Text style={styles.usageValue}>
              {players.length} / {planLimits.players === Infinity ? '無制限' : `${planLimits.players}人`}
            </Text>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>会場</Text>
            <Text style={styles.usageValue}>
              {venues.length} / {planLimits.venues === Infinity ? '無制限' : `${planLimits.venues}件`}
            </Text>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>メンバー</Text>
            <Text style={styles.usageValue}>
              {memberCount} / {planLimits.members === Infinity ? '無制限' : `${planLimits.members}人`}
            </Text>
          </View>
          {!isPremium ? (
            <TouchableOpacity style={styles.upgradeButton} onPress={() => setShowUpgrade(true)}>
              <Ionicons name="star" size={16} color={theme.white} />
              <Text style={styles.upgradeButtonText}>ファミリープランに変更する</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.manageSubButton}
              onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
            >
              <Ionicons name="settings-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.manageSubText}>サブスクリプションを管理する</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 非管理者：プランバッジのみ表示 */}
      {!isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プラン</Text>
          <View style={[styles.planBadge, { backgroundColor: planDisplay.color, alignSelf: 'flex-start' }]}>
            <Text style={styles.planBadgeText}>{planDisplay.label}</Text>
          </View>
        </View>
      )}

      {/* 7. チーム退出 */}
      <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveTeam}>
        <Ionicons name="log-out-outline" size={20} color={theme.danger} />
        <Text style={styles.leaveText}>チームから退出</Text>
      </TouchableOpacity>

      {/* デバッグ用プラン切り替え（開発時・管理者のみ） */}
      {__DEV__ && teamId && isAdmin && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🛠 DEBUG: プラン切り替え</Text>
          <View style={styles.debugRow}>
            {(['free', 'family'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.debugPlanBtn, plan === p && { backgroundColor: PLAN_DISPLAY[p].color }]}
                onPress={() => updateTeamPlan(teamId, p)}
              >
                <Text style={[styles.debugPlanText, plan === p && { color: theme.white }]}>
                  {PLAN_DISPLAY[p].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
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
  memberCount: { fontSize: fontSize.md, color: theme.text, fontWeight: '500' },
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
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: fontSize.sm, color: theme.textSecondary },
  planRow: { marginBottom: spacing.sm },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  planBadgeText: { fontSize: fontSize.sm, fontWeight: '700', color: theme.white },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  usageLabel: { fontSize: fontSize.sm, color: theme.textSecondary },
  usageValue: { fontSize: fontSize.sm, fontWeight: '600', color: theme.text },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  upgradeButtonText: { color: theme.white, fontSize: fontSize.sm, fontWeight: '700' },
  manageSubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  manageSubText: { color: theme.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  leaveText: { color: theme.danger, fontSize: fontSize.md, fontWeight: '600' },
  debugSection: {
    margin: spacing.md,
    marginTop: 0,
    padding: spacing.md,
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderStyle: 'dashed',
  },
  debugTitle: { fontSize: fontSize.xs, fontWeight: '700', color: '#E65100', marginBottom: spacing.sm },
  debugRow: { flexDirection: 'row', gap: spacing.xs },
  debugPlanBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.white,
  },
  debugPlanText: { fontSize: fontSize.xs, fontWeight: '600', color: theme.textSecondary },
});
