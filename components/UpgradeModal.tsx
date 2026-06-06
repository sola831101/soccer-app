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
  // 社会的証明（例「これまでに○件の試合が記録されています」）。事実ベースの値のみ渡すこと。
  socialProof?: string;
}

// 無料 vs ファミリーの比較。値は lib/plans.ts の PLAN_LIMITS と一致させること。
const COMPARE_ROWS: { label: string; free: string; family: string; highlight?: boolean }[] = [
  { label: '試合の記録',     free: '月5件',   family: '無制限', highlight: true },
  { label: '試合の写真',     free: '1枚/試合', family: '20枚/試合', highlight: true },
  { label: '広告',           free: 'あり',    family: 'なし',   highlight: true },
  { label: '子どもの顔写真', free: '×',       family: '○',      highlight: true },
  { label: '所属チーム履歴', free: '×',       family: '○' },
  { label: 'トレセン歴',     free: '×',       family: '○' },
  { label: 'メンバー招待',   free: '2人',     family: '10人' },
  { label: '選手登録',       free: '2人',     family: '20人' },
  { label: 'データ保持',     free: '12ヶ月',  family: 'ずっと' },
];

export function UpgradeModal({ visible, onClose, onUpgrade, reason, socialProof }: UpgradeModalProps) {
  const { syncPurchaseState, team, user } = useTeam();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  // オーナー判定: メンバーが購入してもFirestoreルールでplan更新が拒否される（permission-denied）。
  // 課金は成立するのに機能反映されない事故を防ぐため、購入フロー自体をオーナー限定にする。
  // team/user未ロード時は判定不能なのでローディング表示にする（オーナーに誤って「管理者のみ」を見せない）。
  const isLoading = !team || !user;
  const isAdmin = !!(team && user && team.createdBy === user.uid);

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
          {/* 1. 砂時計アラート（最初に：感情・社会的証明） */}
          {!!socialProof && (
            <View style={styles.emotionCard}>
              <Ionicons name="hourglass-outline" size={22} color="#F9A825" />
              <Text style={styles.emotionText}>{socialProof}</Text>
            </View>
          )}

          {/* 2. 無料プランの限界＋有料でできること（背景色付き説明） */}
          {reason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}

          {/* 3. 訴求：星マーク＋ファミリープラン */}
          <Ionicons name="star" size={40} color="#4CAF50" style={styles.icon} />
          <Text style={styles.title}>ファミリープラン</Text>
          <Text style={styles.price}>¥300 / 月</Text>
          <Text style={styles.valueNote}>1日あたり約10円。広告なしで、子どもの成長をずっと残せます。</Text>

          <View style={styles.compareCard}>
            <View style={styles.compareHeadRow}>
              <Text style={[styles.compareCell, styles.compareLabelCell]} />
              <Text style={[styles.compareCell, styles.compareValCell, styles.compareHeadFree]}>無料</Text>
              <View style={[styles.compareCell, styles.compareValCell, styles.compareFamilyHead]}>
                <Text style={styles.compareHeadFamilyText}>ファミリー</Text>
              </View>
            </View>
            {COMPARE_ROWS.map((r) => (
              <View key={r.label} style={styles.compareRow}>
                <Text style={[styles.compareCell, styles.compareLabelCell]}>{r.label}</Text>
                <Text style={[styles.compareCell, styles.compareValCell, styles.compareFreeText]}>{r.free}</Text>
                <Text
                  style={[
                    styles.compareCell,
                    styles.compareValCell,
                    styles.compareFamilyText,
                    r.highlight && styles.compareFamilyStrong,
                  ]}
                >
                  {r.family}
                </Text>
              </View>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <Text style={styles.loadingText}>読み込み中…</Text>
            </View>
          ) : isAdmin ? (
            <>
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
            </>
          ) : (
            <View style={styles.memberNotice}>
              <Ionicons name="information-circle-outline" size={20} color="#E65100" />
              <Text style={styles.memberNoticeText}>
                ファミリープランへの加入は、グループの管理者のみ行えます。
                管理者の方にご相談ください。プラン加入後は、グループメンバー全員でファミリープランの機能を利用できます。
              </Text>
            </View>
          )}
        </ScrollView>

        {/* CTAは画面下部に固定（スクロールしても常に表示） */}
        {!isLoading && (
          <View style={styles.footer}>
            {isAdmin ? (
              <TouchableOpacity
                style={[styles.purchaseButton, styles.footerButton, (loading || loadingOfferings || !pkg) && { opacity: 0.6 }]}
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
            ) : (
              <TouchableOpacity style={styles.closeAltButton} onPress={onClose}>
                <Text style={styles.closeAltText}>閉じる</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
  valueNote: {
    fontSize: fontSize.sm,
    color: theme.text,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  emotionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FFE082',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  emotionText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#5D4037',
    fontWeight: '700',
    lineHeight: 21,
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
  compareCard: {
    width: '100%',
    backgroundColor: theme.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  compareHeadRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  compareCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  compareLabelCell: {
    flex: 1.4,
    fontSize: fontSize.sm,
    color: theme.text,
    paddingLeft: spacing.md,
  },
  compareValCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.sm,
  },
  compareHeadFree: {
    color: theme.textSecondary,
    fontWeight: '700',
    textAlignVertical: 'center',
  },
  compareFamilyHead: {
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareHeadFamilyText: {
    color: theme.white,
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  compareFreeText: {
    color: theme.textSecondary,
  },
  compareFamilyText: {
    color: theme.text,
    fontWeight: '700',
    backgroundColor: '#F1F8E9',
  },
  compareFamilyStrong: {
    color: '#2E7D32',
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  footerButton: {
    marginBottom: 0,
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
  memberNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    width: '100%',
    marginBottom: spacing.md,
  },
  memberNoticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#E65100',
    lineHeight: 20,
  },
  closeAltButton: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: theme.border,
  },
  closeAltText: {
    color: theme.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  loadingBlock: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    width: '100%',
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
  },
});
