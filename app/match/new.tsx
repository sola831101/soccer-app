import React, { useState } from 'react';
import { Alert, ActivityIndicator, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { theme } from '../../constants/theme';
import { useTeam } from '../../lib/context/TeamContext';
import { createMatch } from '../../lib/firestore';
import { MatchFormData } from '../../lib/types';
import { MatchForm } from '../../components/MatchForm';
import { UpgradeModal } from '../../components/UpgradeModal';
import { PLAN_LIMITS } from '../../lib/plans';
import { maybeRequestReview } from '../../lib/review';

export default function NewMatchScreen() {
  const { teamId, matches, plan, totalMatchCount } = useTeam();
  const [saving, setSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const matchLimit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.matchesPerMonth ?? PLAN_LIMITS.free.matchesPerMonth;

  const handleSubmit = async (data: MatchFormData) => {
    if (!teamId) return;

    const now = new Date();
    const matchesThisMonth = matches.filter((m) => {
      const d = m.date.toDate();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    if (matchLimit !== Infinity && matchesThisMonth.length >= matchLimit) {
      setShowUpgrade(true);
      return;
    }

    setSaving(true);
    try {
      await createMatch(teamId, data);
      maybeRequestReview({
        totalMatchCount: matches.length + 1,
        currentMonthMatchCount: matchesThisMonth.length + 1,
      });
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
        reason={`無料プランは月${PLAN_LIMITS.free.matchesPerMonth}件まで試合を登録できます。ファミリープランにすると無制限に登録できます。`}
        socialProof={totalMatchCount > 0 ? `これまで${totalMatchCount}件の試合を記録してきました。` : undefined}
      />
    </>
  );
}
