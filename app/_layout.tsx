import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { TeamProvider } from '../lib/context/TeamContext';
import { theme } from '../constants/theme';
import { ForceUpdateModal } from '../components/ForceUpdateModal';
import { AppVersionConfig, needsForceUpdate, subscribeToAppVersion } from '../lib/version';
import { AnnouncementModal } from '../components/AnnouncementModal';
import {
  AnnouncementConfig,
  subscribeToAnnouncement,
  getSeenAnnouncementId,
  markAnnouncementSeen,
  shouldShowAnnouncement,
} from '../lib/announcement';

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn ?? '',
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
});

const isExpoGo = Constants.appOwnership === 'expo';

function useTrackingPermission() {
  useEffect(() => {
    if (Platform.OS !== 'ios' || isExpoGo) return;
    let mobileAds: any = null;
    try { mobileAds = require('react-native-google-mobile-ads'); } catch { return; }
    mobileAds.requestTrackingTransparencyPermission?.().catch(() => {});
  }, []);
}

export default function RootLayout() {
  useTrackingPermission();

  const [versionConfig, setVersionConfig] = useState<AppVersionConfig | null>(null);
  useEffect(() => {
    const unsub = subscribeToAppVersion(setVersionConfig);
    return unsub;
  }, []);
  const forceUpdate = needsForceUpdate(versionConfig);

  // アプリ内お知らせ（新機能告知など）
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState<AnnouncementConfig | null>(null);
  const [seenId, setSeenId] = useState<string | null>(null);
  const [seenLoaded, setSeenLoaded] = useState(false);
  useEffect(() => {
    getSeenAnnouncementId().then((id) => {
      setSeenId(id);
      setSeenLoaded(true);
    });
  }, []);
  useEffect(() => {
    const unsub = subscribeToAnnouncement(setAnnouncement);
    return unsub;
  }, []);
  const showAnnouncement =
    seenLoaded &&
    !forceUpdate &&
    !pathname.startsWith('/onboarding') &&
    shouldShowAnnouncement(announcement, seenId);
  const handleCloseAnnouncement = () => {
    if (announcement?.id) {
      markAnnouncementSeen(announcement.id);
      setSeenId(announcement.id);
    }
  };

  return (
    <TeamProvider>
      <StatusBar style="dark" />
      <ForceUpdateModal visible={forceUpdate} config={versionConfig} />
      <AnnouncementModal
        visible={showAnnouncement}
        config={announcement}
        onClose={handleCloseAnnouncement}
      />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: '600', color: theme.text },
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="match/new"
          options={{ title: '試合を登録', presentation: 'modal' }}
        />
        <Stack.Screen
          name="match/[id]"
          options={{ title: '試合詳細' }}
        />
        <Stack.Screen
          name="venues"
          options={{ title: '会場管理', headerBackVisible: true }}
        />
        <Stack.Screen
          name="players"
          options={{ title: '選手情報' }}
        />
        <Stack.Screen
          name="player/[id]"
          options={{ title: '選手詳細' }}
        />
        <Stack.Screen
          name="settings/members"
          options={{ title: 'グループメンバー・招待コード' }}
        />
        <Stack.Screen
          name="settings/plan"
          options={{ title: 'プラン' }}
        />
      </Stack>
    </TeamProvider>
  );
}
