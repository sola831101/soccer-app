import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { EmailLinkModal } from '../../components/EmailLinkModal';

const EMAIL_LINKED_KEY = 'email_linked_permanently';

export default function TabLayout() {
  const { teamId, loading, authLoading, isEmailLinked, user } = useTeam();
  const [emailLinkedLocally, setEmailLinkedLocally] = useState(false);

  // 永続化されたメール登録フラグを読み込む
  useEffect(() => {
    AsyncStorage.getItem(EMAIL_LINKED_KEY).then((val) => {
      if (val === 'true') setEmailLinkedLocally(true);
    });
  }, []);

  // isEmailLinkedがtrueになったら永続化
  useEffect(() => {
    if (isEmailLinked) {
      AsyncStorage.setItem(EMAIL_LINKED_KEY, 'true');
      setEmailLinkedLocally(true);
    }
  }, [isEmailLinked]);

  if (loading || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!teamId) {
    return <Redirect href="/onboarding" />;
  }

  // セッション消失時（メール登録済みだがAuthがnull）はオンボーディングで再認証
  if (!user) {
    return <Redirect href="/onboarding" />;
  }

  const needsEmailRegistration = !!user && !isEmailLinked && !emailLinkedLocally;

  return (
    <>
      <EmailLinkModal
        visible={needsEmailRegistration}
        onClose={() => {}}
        onSuccess={() => setEmailLinkedLocally(true)}
        forced
      />
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.white,
          borderTopColor: theme.border,
        },
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { fontWeight: '600', color: theme.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'カレンダー',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="data"
        options={{
          title: 'データ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </>
  );
}
