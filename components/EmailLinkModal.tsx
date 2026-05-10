import React, { useState } from 'react';
import {
  Modal,
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
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { sendOTP, linkEmailToCurrentUser } from '../lib/auth';

interface EmailLinkModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  forced?: boolean;
}

export function EmailLinkModal({ visible, onClose, onSuccess, forced = false }: EmailLinkModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('email');
    setEmail('');
    setOtpCode('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

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
    } catch {
      Alert.alert('エラー', 'メール送信に失敗しました。もう一度お試しください');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('入力エラー', '6桁のコードを入力してください');
      return;
    }
    setLoading(true);
    try {
      await linkEmailToCurrentUser(email.trim().toLowerCase(), otpCode.trim());
      onSuccess?.();
      Alert.alert('登録完了', 'メールアドレスが登録されました。次回以降このメールでデータを引き継げます。', [
        { text: 'OK', onPress: handleClose },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'エラーが発生しました';
      Alert.alert('認証エラー', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={forced ? undefined : handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          {step === 'otp' ? (
            <TouchableOpacity onPress={() => setStep('email')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          {!forced && (
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          <Ionicons name="mail-outline" size={48} color={theme.primary} style={styles.icon} />

          {step === 'email' ? (
            <>
              <Text style={styles.title}>メールアドレスを登録</Text>
              <Text style={styles.subtitle}>
                機種変更や再インストール時に、同じメールアドレスでデータを引き継げます。
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
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={styles.buttonText}>認証コードを送信</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>認証コードを入力</Text>
              <Text style={styles.subtitle}>{email} に6桁のコードを送信しました。</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={otpCode}
                onChangeText={(t) => setOtpCode(t.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.white} />
                ) : (
                  <Text style={styles.buttonText}>確認</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendButton} onPress={handleSendOTP} disabled={loading}>
                <Text style={styles.resendText}>コードを再送する</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  backButton: { padding: spacing.xs, width: 40 },
  closeButton: { padding: spacing.xs },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  icon: { alignSelf: 'center', marginBottom: spacing.md },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textAlign: 'center',
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
  button: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.white, fontSize: fontSize.md, fontWeight: '700' },
  resendButton: { alignItems: 'center', marginTop: spacing.md },
  resendText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textDecorationLine: 'underline',
  },
});
