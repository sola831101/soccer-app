export type Plan = 'free' | 'family';

export const PLAN_LIMITS = {
  free: {
    matchesPerMonth: 5,
    players: 2,
    venues: 5,
    members: 2,
    dataRetentionMonths: 12,
    showAds: true,
    playerStats: false,
    stepRecords: false,
    playerPhoto: false,
    toreisenRecords: false,
    teamIcon: false,
  },
  family: {
    matchesPerMonth: Infinity,
    players: 20,
    venues: Infinity,
    members: 10,
    dataRetentionMonths: Infinity,
    showAds: false,
    playerStats: false,
    stepRecords: true,     // 所属チーム履歴
    playerPhoto: true,     // 顔写真
    toreisenRecords: true, // トレセン歴
    teamIcon: true,        // 所属チームアイコン
  },
} as const;

export type PlanLimitKey = keyof typeof PLAN_LIMITS.free;

export function getPlanLimit(plan: Plan, key: PlanLimitKey) {
  return PLAN_LIMITS[plan][key];
}

export function isPaidPlan(plan: Plan): boolean {
  return plan !== 'free';
}

export function hasFeature(
  plan: Plan,
  feature: 'playerStats' | 'stepRecords' | 'playerPhoto' | 'toreisenRecords' | 'teamIcon'
): boolean {
  return PLAN_LIMITS[plan][feature];
}

export const PLAN_DISPLAY = {
  free:   { label: 'フリー',     price: '¥0',    color: '#9E9E9E' },
  family: { label: 'ファミリー', price: '¥300/月', color: '#4CAF50' },
} as const;
