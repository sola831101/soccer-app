import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme, fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';

export default function MembersSettingsScreen() {
  const { team, user, memberCount, setTeamId } = useTeam();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!team) return;
    await Clipboard.setStringAsync(team.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (!team) {
    return (
      <>
        <Stack.Screen options={{ title: 'グループメンバー・招待コード' }} />
        <View style={styles.container} />
      </>
    );
  }

  const isAdmin = user?.uid === team.createdBy;

  return (
    <>
      <Stack.Screen options={{ title: 'グループメンバー・招待コード' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.row}>
            <Ionicons name="people-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.memberCount}>{memberCount}人が参加中</Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>招待コード</Text>
            <Text style={styles.description}>
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
          </View>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveTeam}>
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <Text style={styles.leaveText}>チームから退出</Text>
        </TouchableOpacity>
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
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  memberCount: { fontSize: fontSize.md, color: theme.text, fontWeight: '500' },
  description: { fontSize: fontSize.sm, color: theme.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
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
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  leaveText: { color: theme.danger, fontSize: fontSize.md, fontWeight: '600' },
});
