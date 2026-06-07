import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { AnnouncementConfig } from '../lib/announcement';

interface Props {
  visible: boolean;
  config: AnnouncementConfig | null;
  onClose: () => void;
}

export function AnnouncementModal({ visible, config, onClose }: Props) {
  if (!config) return null;

  const handleCta = () => {
    onClose();
    const route = config.ctaRoute;
    if (!route) return;
    if (/^https?:\/\//.test(route)) {
      Linking.openURL(route).catch(() => {});
    } else {
      router.push(route as never);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={26} color={theme.primary} />
          </View>
          {!!config.title && <Text style={styles.title}>{config.title}</Text>}
          {!!config.body && <Text style={styles.body}>{config.body}</Text>}
          {!!config.ctaLabel && (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleCta} activeOpacity={0.85}>
              <Text style={styles.ctaText}>{config.ctaLabel}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.md,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  ctaBtn: {
    backgroundColor: theme.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ctaText: {
    color: theme.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  closeText: {
    color: theme.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
