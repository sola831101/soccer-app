import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { updateTeamPlan } from '../../lib/firestore';
import { UpgradeModal } from '../../components/UpgradeModal';
import { PLAN_LIMITS, PLAN_DISPLAY } from '../../lib/plans';

export default function PlanSettingsScreen() {
  const {
    team, teamId, user, isPremium, plan, matches, venues, players, memberCount,
    syncPurchaseStateManual, syncState,
  } = useTeam();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  const handleManualSync = async () => {
    if (manualSyncing) return;
    setManualSyncing(true);
    try {
      const result = await syncPurchaseStateManual();
      if (result.ok) {
        Alert.alert('同期完了', '購入状態を最新に反映しました。');
      } else {
        Alert.alert(
          '同期に失敗しました',
          '購入状態を取得できませんでした。ネットワーク接続をご確認の上、再度お試しください。問題が続く場合はサポートまでお問い合わせください。'
        );
      }
    } finally {
      setManualSyncing(false);
    }
  };

  if (!team) {
    return (
      <>
        <Stack.Screen options={{ title: 'プラン' }} />
        <View style={styles.container} />
      </>
    );
  }

  const isAdmin = user?.uid === team.createdBy;
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const planDisplay = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const now = new Date();
  const matchesThisMonth = matches.filter((m) => {
    const d = m.date.toDate();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  return (
    <>
      <Stack.Screen options={{ title: 'プラン' }} />
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => setShowUpgrade(false)}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.planRow}>
            <View style={[styles.planBadge, { backgroundColor: planDisplay.color }]}>
              <Text style={styles.planBadgeText}>{planDisplay.label}</Text>
            </View>
          </View>
          {isAdmin ? (
            <>
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
            </>
          ) : (
            <Text style={styles.noteText}>
              プラン変更や使用状況の確認は管理者のみ行えます。
            </Text>
          )}
        </View>

        {/* 購入状態を同期: 「課金したのに反映されない」時の救済導線 */}
        {isAdmin && (
          <View style={styles.section}>
            {syncState === 'error' && (
              <View style={styles.syncErrorBanner}>
                <Ionicons name="warning-outline" size={16} color="#C62828" />
                <Text style={styles.syncErrorText}>
                  購入状態の同期に失敗しました。下のボタンで再試行できます。
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.syncButton, manualSyncing && styles.syncButtonDisabled]}
              onPress={handleManualSync}
              disabled={manualSyncing}
            >
              {manualSyncing ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
              )}
              <Text style={styles.syncButtonText}>
                {manualSyncing ? '同期中…' : '購入状態を同期'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.syncHint}>
              課金したのにプランが反映されない場合にお試しください。
            </Text>
          </View>
        )}

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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  content: { padding: spacing.md },
  section: {
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
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
  noteText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    paddingVertical: spacing.sm,
    lineHeight: 20,
  },
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
  syncErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  syncErrorText: { flex: 1, color: '#C62828', fontSize: fontSize.xs },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: theme.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  syncHint: { fontSize: fontSize.xs, color: theme.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  debugSection: {
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
