import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TeamProvider } from '../lib/context/TeamContext';
import { theme } from '../constants/theme';

export default function RootLayout() {
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
          options={{ title: '試合詳細', headerBackVisible: false }}
        />
        <Stack.Screen
          name="venues"
          options={{ title: '会場管理', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="players"
          options={{ title: '選手管理', headerBackTitle: '' }}
        />
      </Stack>
    </TeamProvider>
  );
}
