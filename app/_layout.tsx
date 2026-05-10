import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { TeamProvider } from '../lib/context/TeamContext';
import { theme } from '../constants/theme';

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

  return (
    <TeamProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: '600', color: theme.text },
          headerBackTitle: ' ',
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
          options={{ title: '会場管理', headerBackTitle: ' ', headerBackVisible: true }}
        />
        <Stack.Screen
          name="players"
          options={{ title: '選手情報', headerBackTitle: ' ' }}
        />
        <Stack.Screen
          name="player/[id]"
          options={{ title: '選手詳細', headerBackTitle: ' ' }}
        />
      </Stack>
    </TeamProvider>
  );
}
