import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage } from '../lib/purchases';
import { theme, fontSize, spacing, borderRadius } from '../constants/theme';
import { getOfferings, purchasePackage, restorePurchases, isPremiumCustomer } from '../lib/purchases';
import { useTeam } from '../lib/context/TeamContext';

const PRIVACY_POLICY_URL = 'https://sola831101.github.io/soccer-app/privacy-policy.html';
const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  reason?: string;
}

const FAMILY_FEATURES = [
  { icon: 'infinite-outline',      text: '試合記録：無制限' },
  { icon: 'people-outline',        text: 'メンバー招待：10人まで' },
  { icon: 'person-outline',        text: '選手登録：20人まで' },
  { icon: 'ban-outline',           text: '広告なし・快適に使える' },
  { icon: 'images-outline',        text: '子どもの顔写真を登録' },
  { icon: 'football-outline',      text: '所属チーム履歴を記録' },
  { icon: 'ribbon-outline',        text: 'トレセン歴を記録' },
];

export function UpgradeModal({ visible, onClose, onUpgrade, reason }: UpgradeModalProps) {
  const { syncPurchaseState } = useTeam();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoadingOfferings(true);
    getOfferings().then((offering) => {
      const pkgs = offering?.availablePackages ?? [];
      if (pkgs.length > 0) setPkg(pkgs[0]);
      setLoadingOfferings(false);
    });
  }, [visible]);

  const handlePurchase = async () => {
    if (!pkg) return;
    setLoading(true);
    try {
      await purchasePackage(pkg);
      // purchasePackage はキャンセル・失敗時に例外を投げるため、ここに到達 = 購入成功
      await syncPurchaseState('family');
      Alert.alert('購入完了', 'ファミリープランへようこそ！', [
        { text: 'OK', onPress: () => { onClose(); onUpgrade?.(); } },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('cancelled') && !msg.includes('userCancelled')) {
        Alert.alert('エラー', '購入処理に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const customerInfo = await restorePurchases();
      if (isPremiumCustomer(customerInfo)) {
        await syncPurchaseState('family');
        Alert.alert('復元完了', 'ファミリープランが復元されました。', [
          { text: 'OK', onPress: () => { onClose(); onUpgrade?.(); } },
        ]);
      } else {
        Alert.alert('購入履歴なし', '復元できる購入が見つかりませんでした。');
      }
    } catch {
      Alert.alert('エラー', '購入の復元に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Ionicons name="star" size={40} color="#4CAF50" style={styles.icon} />
          <Text style={styles.title}>ファミリープラン</Text>
          <Text style={styles.price}>¥300 / 月</Text>
          <Text style={styles.tagline}>家族でお子さんの成長を記録</Text>

          {reason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}

          <View style={styles.featureCard}>
            {FAMILY_FEATURES.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <Ionicons name={f.icon as any} size={18} color="#4CAF50" />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.freeCompare}>
            <Text style={styles.freeCompareText}>
              フリープランは月5件・広告あり・子ども情報管理なし・データ12ヶ月保持
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.purchaseButton, (loading || loadingOfferings || !pkg) && { opacity: 0.6 }]}
            onPress={handlePurchase}
            disabled={loading || loadingOfferings || !pkg}
          >
            {loading ? (
              <ActivityIndicator color={theme.white} />
            ) : (
              <>
                <Ionicons name="star" size={18} color={theme.white} />
                <Text style={styles.purchaseButtonText}>ファミリープランに変更する</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.restoreButton}>
            <Text style={styles.restoreText}>購入を復元する</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            App Storeで購入処理が行われます。いつでもキャンセル可能です。{'\n'}
            サブスクリプション名：サカログ ファミリープラン（月額）
          </Text>

          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={styles.legalLink}>プライバシーポリシー</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>｜</Text>
            <TouchableOpacity onPress={() => Linking.openURL(EULA_URL)}>
              <Text style={styles.legalLink}>利用規約（EULA）</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  closeButton: { padding: spacing.xs },
  content: { padding: spacing.lg, alignItems: 'center' },
  icon: { marginBottom: spacing.sm },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  price: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: '#4CAF50',
    marginBottom: 4,
  },
  tagline: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  reasonBox: {
    width: '100%',
    backgroundColor: '#FFF3E0',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    marginBottom: spacing.md,
  },
  reasonText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureCard: {
    width: '100%',
    backgroundColor: '#F1F8E9',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#4CAF50',
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: fontSize.sm,
    color: theme.text,
    flex: 1,
    lineHeight: 20,
  },
  freeCompare: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  freeCompareText: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  purchaseButton: {
    backgroundColor: '#4CAF50',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  purchaseButtonText: {
    color: theme.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  restoreButton: { padding: spacing.sm, marginBottom: spacing.sm },
  restoreText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textDecorationLine: 'underline',
  },
  note: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    gap: 4,
  },
  legalLink: {
    fontSize: fontSize.xs,
    color: theme.primary,
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
  },
});
