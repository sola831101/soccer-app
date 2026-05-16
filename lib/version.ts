import { doc, onSnapshot } from 'firebase/firestore';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from './firebase';

export interface AppVersionConfig {
  minimumIosVersion?: string;
  minimumAndroidVersion?: string;
  latestIosVersion?: string;
  latestAndroidVersion?: string;
  message?: string;
}

export const CURRENT_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

// セマンティックバージョン比較: a < b → -1, a == b → 0, a > b → 1
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

export function subscribeToAppVersion(callback: (config: AppVersionConfig | null) => void) {
  const ref = doc(db, 'config', 'app_version');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as AppVersionConfig);
    },
    () => callback(null)
  );
}

export function needsForceUpdate(config: AppVersionConfig | null): boolean {
  if (!config) return false;
  if (__DEV__) return false;
  const minVersion = Platform.OS === 'ios' ? config.minimumIosVersion : config.minimumAndroidVersion;
  if (!minVersion) return false;
  return compareVersions(CURRENT_VERSION, minVersion) < 0;
}

// ストアURL（App Store ID は後で差し替え）
export const STORE_URLS = {
  ios: 'https://apps.apple.com/jp/app/id6760473038',
  android: 'https://play.google.com/store/apps/details?id=com.soccerapp.manager',
};
