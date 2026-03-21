import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { useTeam } from '../lib/context/TeamContext';
import { createTeam, joinTeam } from '../lib/firestore';

type Mode = 'select' | 'create' | 'join';

export default function OnboardingScreen() {
  const { user, setTeamId } = useTeam();
  const [mode, setMode] = useState<Mode>('select');
  const [teamName, setTeamName] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!teamName.trim()) {
      Alert.alert('入力エラー', 'チーム名を入力してください');
      return;
    }
    if (!user) {
      Alert.alert('エラー', '認証中です。しばらくお待ちください');
      return;
    }

    setLoading(true);
    try {
      const team = await createTeam(teamName.trim(), user.uid);
      await setTeamId(team.id);
      Alert.alert(
        'チーム作成完了',
        `共有コード: ${team.shareCode}\n\n家族にこのコードを共有してください`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (e) {
      Alert.alert('エラー', 'チームの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!shareCode.trim()) {
      Alert.alert('入力エラー', '共有コードを入力してください');
      return;
    }
    if (!user) {
      Alert.alert('エラー', '認証中です。しばらくお待ちください');
      return;
    }

    setLoading(true);
    try {
      const team = await joinTeam(shareCode.trim(), user.uid);
      if (!team) {
        Alert.alert('エラー', 'コードが見つかりません。正しいコードを入力してください');
        return;
      }
      await setTeamId(team.id);
      Alert.alert('参加完了', `${team.name} に参加しました`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      Alert.alert('エラー', 'チームへの参加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Ionicons name="football-outline" size={80} color={theme.primary} />
          <Text style={styles.title}>サカログ</Text>
          <Text style={styles.subtitle}>試合の予定・結果を{'\n'}家族で共有しよう</Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setMode('create')}>
            <Ionicons name="add-circle-outline" size={24} color={theme.white} />
            <Text style={styles.primaryButtonText}>チームを作成</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode('join')}>
            <Ionicons name="people-outline" size={24} color={theme.primary} />
            <Text style={styles.secondaryButtonText}>コードで参加</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => setMode('select')}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>

      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>
          {mode === 'create' ? 'チームを作成' : 'チームに参加'}
        </Text>
        <Text style={styles.formSubtitle}>
          {mode === 'create'
            ? 'お子さんのチーム名を入力してください'
            : '共有されたコードを入力してください'}
        </Text>

        {mode === 'create' ? (
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="例: 〇〇FC U-10"
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
        ) : (
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={shareCode}
            onChangeText={(text) => setShareCode(text.toUpperCase())}
            placeholder="例: ABC123"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            maxLength={6}
            autoFocus
          />
        )}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === 'create' ? '作成する' : '参加する'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: theme.primary,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  buttons: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: theme.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  formContainer: {
    paddingHorizontal: spacing.lg,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
  },
  formSubtitle: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: theme.text,
    backgroundColor: theme.white,
    marginBottom: spacing.lg,
  },
  codeInput: {
    fontSize: fontSize.xl,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '700',
  },
});
