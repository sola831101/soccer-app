import React, { useState } from 'react';
import { Alert, ActivityIndicator, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { createMatch } from '../../lib/firestore';
import { MatchFormData } from '../../lib/types';
import { MatchForm } from '../../components/MatchForm';
import { UpgradeModal } from '../../components/UpgradeModal';
import { PLAN_LIMITS } from '../../lib/plans';

const MATCH_COUNT_KEY = 'match_count_for_review';
const REVIEW_REQUESTED_KEY = 'review_requested';

async function requestReviewIfAppropriate() {
  const alreadyRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
  if (alreadyRequested) return;

  const countStr = await AsyncStorage.getItem(MATCH_COUNT_KEY);
  const count = parseInt(countStr ?? '0', 10) + 1;
  await AsyncStorage.setItem(MATCH_COUNT_KEY, count.toString());

  if (count === 3 && await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
  }
}

export default function NewMatchScreen() {
  const { teamId, matches, plan } = useTeam();
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const matchLimit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.matchesPerMonth ?? PLAN_LIMITS.free.matchesPerMonth;

  const handleSubmit = async (data: MatchFormData) => {
    if (!teamId) return;

    if (matchLimit !== Infinity) {
      const now = new Date();
      const matchesThisMonth = matches.filter((m) => {
        const d = m.date.toDate();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
      if (matchesThisMonth.length >= matchLimit) {
        setShowUpgrade(true);
        return;
      }
    }

    setSaving(true);
    try {
      await createMatch(teamId, data);
      requestReviewIfAppropriate();
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
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => setShowUpgrade(false)}
        reason={`無料プランは月${PLAN_LIMITS.free.matchesPerMonth}件まで試合を登録できます。プランをアップグレードすると無制限に登録できます。`}
      />
    </>
  );
}
