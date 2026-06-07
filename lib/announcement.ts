import { doc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

// アプリ内お知らせ（新機能告知など）。Firebase Console の config/announcement で制御。
// アプリ更新なしで文面・表示ON/OFF・導線を変更できる。
export interface AnnouncementConfig {
  id?: string;       // この告知の一意ID（既読管理に使用。変えると再表示される）
  active?: boolean;  // 表示ON/OFF
  title?: string;
  body?: string;
  ctaLabel?: string; // 任意：ボタン文言（例: プランを見る）
  ctaRoute?: string; // 任意：遷移先（例: /settings/plan。http(s) で始まれば外部URLを開く）
}

const SEEN_KEY = 'announcement_seen_id';

export function subscribeToAnnouncement(callback: (config: AnnouncementConfig | null) => void) {
  const ref = doc(db, 'config', 'announcement');
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? (snap.data() as AnnouncementConfig) : null),
    () => callback(null)
  );
}

export async function getSeenAnnouncementId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export async function markAnnouncementSeen(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, id);
  } catch {
    /* 既読保存に失敗しても致命的ではない */
  }
}

// 表示すべきか：active かつ id があり、未読（前回既読IDと異なる）
export function shouldShowAnnouncement(
  config: AnnouncementConfig | null,
  seenId: string | null
): boolean {
  return !!config && config.active === true && !!config.id && config.id !== seenId;
}
