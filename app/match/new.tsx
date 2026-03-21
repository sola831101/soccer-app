import React, { useState } from 'react';
import { Alert, ActivityIndicator, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { theme } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { createMatch } from '../../lib/firestore';
import { MatchFormData } from '../../lib/types';
import { MatchForm } from '../../components/MatchForm';

export default function NewMatchScreen() {
  const { teamId } = useTeam();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: MatchFormData) => {
    if (!teamId) return;

    setSaving(true);
    try {
      await createMatch(teamId, data);
      router.back();
    } catch {
      Alert.alert('エラー', '試合の登録に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (saving) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '試合を登録' }} />
      <MatchForm onSubmit={handleSubmit} />
    </>
  );
}
