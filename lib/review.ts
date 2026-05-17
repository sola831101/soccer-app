import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { Linking, Alert } from 'react-native';

const KEY_REQUESTED_VERSION = 'review_requested_version';
const REVIEW_URL = 'https://apps.apple.com/jp/app/id6760473038?action=write-review';
const FEEDBACK_FORM_URL = 'https://forms.gle/wMoULkbup4K7CQGNA';

/**
 * 試合登録時のレビュー促進判定（自動）
 * - 累計5件目 or 毎月2件目で表示
 * - 現バージョンで表示済みならスキップ（バージョンアップで再度表示可能）
 */
export async function maybeRequestReview(opts: {
  totalMatchCount: number;
  currentMonthMatchCount: number;
}): Promise<void> {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const lastVersion = await AsyncStorage.getItem(KEY_REQUESTED_VERSION);

  if (lastVersion === currentVersion) return;

  const shouldShow =
    opts.totalMatchCount === 5 ||
    opts.currentMonthMatchCount === 2;

  if (!shouldShow) return;

  if (await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview();
    await AsyncStorage.setItem(KEY_REQUESTED_VERSION, currentVersion);
  }
}

/**
 * ネイティブレビューダイアログを開く
 * 利用不可ならApp Storeレビューページに遷移
 */
async function openReviewDialog(): Promise<void> {
  if (await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview();
  } else {
    Linking.openURL(REVIEW_URL).catch(() => {});
  }
}

/**
 * Googleフォームの問い合わせを開く
 */
function openFeedbackForm(): void {
  Linking.openURL(FEEDBACK_FORM_URL).catch(() => {});
}

/**
 * 設定画面からの「ご意見・ご感想」ダイアログ
 * - 「役に立っている」→ レビュー誘導
 * - 「改善してほしい」→ 問い合わせフォーム
 */
export function showFeedbackDialog(): void {
  Alert.alert(
    'サカログはお役に立っていますか？',
    'よろしければご感想を聞かせてください',
    [
      { text: 'キャンセル', style: 'cancel' },
      { text: '改善してほしい', onPress: openFeedbackForm },
      { text: '役に立っている', onPress: openReviewDialog, style: 'default' },
    ],
    { cancelable: true }
  );
}
