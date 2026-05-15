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
import { createTeam, joinTeam, getUserTeams } from '../lib/firestore';
import { sendOTP, verifyOTPAndSignIn } from '../lib/auth';

type Step = 'email' | 'otp' | 'select' | 'create' | 'join';

export default function OnboardingScreen() {
  const { user, setTeamId } = useTeam();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('入力エラー', '正しいメールアドレスを入力してください');
      return;
    }
    setLoading(true);
    try {
      await sendOTP(trimmed);
      setStep('otp');
    } catch (e: unknown) {
      const err = e as any;
      const msg = err?.message ?? 'メール送信に失敗しました。もう一度お試しください';
      Alert.alert('エラー', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('入力エラー', '6桁のコードを入力してください');
      return;
    }
    setLoading(true);
    try {
      const uid = await verifyOTPAndSignIn(email.trim().toLowerCase(), otpCode.trim());
      // 既存チームがあればホームへ、なければチーム作成/参加画面へ
      const teams = await getUserTeams(uid);
      if (teams.length > 0) {
        await setTeamId(teams[0].id);
        router.replace('/(tabs)');
      } else {
        setStep('select');
      }
    } catch (e: unknown) {
      const fe = e as any;
      const msg = fe?.message ?? 'コードの確認に失敗しました。もう一度お試しください';
      Alert.alert('認証エラー', msg);
    } finally {
      setLoading(false);
    }
  };

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
    } catch {
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
    } catch (e: any) {
      if (e?.code === 'MEMBER_LIMIT_EXCEEDED') {
        Alert.alert('参加できません', e.message);
      } else {
        Alert.alert('エラー', 'チームへの参加に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  // メール入力画面
  if (step === 'email') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.hero}>
          <Ionicons name="football-outline" size={80} color={theme.primary} />
          <Text style={styles.title}>サカログ</Text>
          <Text style={styles.subtitle}>試合の予定・結果を{'\n'}家族で共有しよう</Text>
        </View>
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>メールアドレスを入力</Text>
          <Text style={styles.formSubtitle}>
            データの引き継ぎや機種変更に使います。認証コードをお送りします。
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.white} />
            ) : (
              <Text style={styles.primaryButtonText}>認証コードを送信</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.legalNote}>
            続行することで、プライバシーポリシーおよび利用規約に同意したものとみなされます。
          </Text>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // OTP入力画面
  if (step === 'otp') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('email')}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>認証コードを入力</Text>
          <Text style={styles.formSubtitle}>
            {email} に6桁のコードを送信しました。
          </Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={otpCode}
            onChangeText={(t) => setOtpCode(t.replace(/[^0-9]/g, ''))}
            placeholder="000000"
            placeholderTextColor="#CCCCCC"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.white} />
            ) : (
              <Text style={styles.primaryButtonText}>確認</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.resendButton} onPress={handleSendOTP} disabled={loading}>
            <Text style={styles.resendText}>コードを再送する</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // チーム選択画面
  if (step === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Ionicons name="football-outline" size={80} color={theme.primary} />
          <Text style={styles.title}>サカログ</Text>
          <Text style={styles.subtitle}>試合の予定・結果を{'\n'}家族で共有しよう</Text>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('create')}>
            <Ionicons name="add-circle-outline" size={24} color={theme.white} />
            <Text style={styles.primaryButtonText}>グループを作成</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('join')}>
            <Ionicons name="people-outline" size={24} color={theme.primary} />
            <Text style={styles.secondaryButtonText}>コードで参加</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // チーム作成・参加画面
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => setStep('select')}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>
          {step === 'create' ? 'グループを作成' : 'グループに参加'}
        </Text>
        <Text style={styles.formSubtitle}>
          {step === 'create'
            ? 'グループ名を入力してください（例: 田中家・〇〇ファミリー）'
            : '共有されたコードを入力してください'}
        </Text>
        {step === 'create' ? (
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="例: 田中家、〇〇ファミリー"
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
          onPress={step === 'create' ? handleCreate : handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === 'create' ? 'グループを作成する' : 'グループに参加する'}
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
  buttonDisabled: { opacity: 0.6 },
  backButton: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  formContainer: { paddingHorizontal: spacing.lg },
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
    lineHeight: 20,
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
  resendButton: { alignItems: 'center', marginTop: spacing.md },
  resendText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textDecorationLine: 'underline',
  },
  legalNote: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
