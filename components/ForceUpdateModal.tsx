import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { STORE_URLS, AppVersionConfig } from '../lib/version';

interface Props {
  visible: boolean;
  config: AppVersionConfig | null;
}

export function ForceUpdateModal({ visible, config }: Props) {
  const handleOpenStore = () => {
    const url = Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
    Linking.openURL(url).catch(() => {});
  };

  const message = config?.message ?? '新しいバージョンへの更新が必要です。\nアプリを最新版にアップデートしてください。';

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.container}>
        <Ionicons
          name="cloud-download-outline"
          size={64}
          color={theme.primary}
          style={styles.icon}
        />
        <Text style={styles.title}>アップデートが必要です</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.button} onPress={handleOpenStore} activeOpacity={0.85}>
          <Text style={styles.buttonText}>
            {Platform.OS === 'ios' ? 'App Storeを開く' : 'Google Playを開く'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  icon: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: theme.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: {
    backgroundColor: theme.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    minWidth: 220,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
