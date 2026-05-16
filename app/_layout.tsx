import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { TeamProvider } from '../lib/context/TeamContext';
import { theme } from '../constants/theme';
import { ForceUpdateModal } from '../components/ForceUpdateModal';
import { AppVersionConfig, needsForceUpdate, subscribeToAppVersion } from '../lib/version';

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

  return (
    <TeamProvider>
      <StatusBar style="dark" />
      <ForceUpdateModal visible={forceUpdate} config={versionConfig} />
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
