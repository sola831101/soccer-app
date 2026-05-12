import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { Team, Match, Venue, Player, Plan } from '../types';
import { subscribeToTeam, subscribeToMatches, subscribeToVenues, subscribeToPlayers, updateTeamPlan } from '../firestore';
import { PLAN_LIMITS, hasFeature, Plan as PlanType } from '../plans';
import { configurePurchases, getCustomerInfo } from '../purchases';

interface TeamContextType {
  user: User | null;
  team: Team | null;
  matches: Match[];
  venues: Venue[];
  players: Player[];
  loading: boolean;
  authLoading: boolean;
  teamId: string | null;
  setTeamId: (id: string | null) => void;
  upcomingMatches: Match[];
  recentResults: Match[];
  plan: Plan;
  isPremium: boolean;
  memberCount: number;
  hasFeature: (feature: Parameters<typeof hasFeature>[1]) => boolean;
  syncPurchaseState: (newPlan?: PlanType) => Promise<void>;
  isEmailLinked: boolean;
}

const TeamContext = createContext<TeamContextType>({
  user: null,
  team: null,
  matches: [],
  venues: [],
  players: [],
  loading: true,
  authLoading: true,
  teamId: null,
  setTeamId: () => {},
  upcomingMatches: [],
  recentResults: [],
  plan: 'free',
  isPremium: false,
  memberCount: 0,
  hasFeature: () => false,
  syncPurchaseState: async () => {},
  isEmailLinked: false,
});

export function useTeam() {
  return useContext(TeamContext);
}

const TEAM_ID_KEY = 'soccer_app_team_id';

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [teamId, setTeamIdState] = useState<string | null>(null);

  const setTeamId = useCallback(async (id: string | null) => {
    setTeamIdState(id);
    if (id) {
      await AsyncStorage.setItem(TEAM_ID_KEY, id);
    } else {
      await AsyncStorage.removeItem(TEAM_ID_KEY);
    }
  }, []);

  // Auth状態監視（メール認証 or カスタムトークン）
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // 旧バージョンからのアップデートユーザー向け：
        // teamIdがあるのにAuthがない場合は匿名ログインしてメール登録モーダルを出す
        // ただしメール登録済みユーザーの場合はセッション消失の可能性があるため
        // 匿名サインインせず、_layout.tsxのリダイレクトでオンボーディングへ誘導する
        const savedTeamId = await AsyncStorage.getItem(TEAM_ID_KEY);
        const emailLinked = await AsyncStorage.getItem('email_linked_permanently');
        if (savedTeamId && !emailLinked) {
          try {
            await signInAnonymously(auth);
            // onAuthStateChangedが再度発火するのでここではreturn
            return;
          } catch (e) {
            console.warn('[Auth] signInAnonymously failed:', e);
          }
        }
        setUser(null);
        setAuthLoading(false);
        return;
      }
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        try {
          await configurePurchases(firebaseUser.uid);
        } catch (e) {
          console.warn('[Purchases] configure error:', e);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Load saved team ID
  useEffect(() => {
    AsyncStorage.getItem(TEAM_ID_KEY).then((id) => {
      if (id) setTeamIdState(id);
      setLoading(false);
    });
  }, []);

  // Subscribe to team
  useEffect(() => {
    if (!teamId || !user) {
      if (!teamId) {
        setTeam(null);
        setAllMatches([]);
        setVenues([]);
        setPlayers([]);
      }
      return;
    }

    const unsubTeam = subscribeToTeam(teamId, setTeam);
    const unsubMatches = subscribeToMatches(teamId, setAllMatches);
    const unsubVenues = subscribeToVenues(teamId, setVenues);
    const unsubPlayers = subscribeToPlayers(teamId, setPlayers);

    return () => {
      unsubTeam();
      unsubMatches();
      unsubVenues();
      unsubPlayers();
    };
  }, [teamId, user]);

  const plan: Plan = (team?.plan ?? 'free') as Plan;
  const isPremium = plan !== 'free';
  const isEmailLinked = !!(user && !user.isAnonymous);

  const memberCount = useMemo(() => team?.memberIds?.length ?? 0, [team]);


  // RevenueCat の購入状態を Firestore と同期
  const syncPurchaseState = useCallback(async (newPlan?: PlanType) => {
    if (!teamId) return;
    try {
      if (newPlan) {
        await updateTeamPlan(teamId, newPlan);
        return;
      }
      const customerInfo = await getCustomerInfo();
      if (!customerInfo) return;
      // RC が premium entitlement を確認できた場合のみ Firestore を family に更新
      // RC が未確認でも自動ダウングレードはしない（Firestore の plan を正とする）
      const hasPremium = !!customerInfo.entitlements.active['premium'];
      if (hasPremium) {
        await updateTeamPlan(teamId, 'family');
      }
    } catch (e) {
      console.error('[Purchases] syncPurchaseState error:', e);
    }
  }, [teamId]);

  // 起動時に購入状態を同期
  useEffect(() => {
    if (teamId && user) {
      syncPurchaseState();
    }
  }, [teamId, user, syncPurchaseState]);

  // 無料プランはデータ保持12ヶ月に制限
  const matches = useMemo(() => {
    if (isPremium) return allMatches;
    const retentionMonths = PLAN_LIMITS.free.dataRetentionMonths;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    return allMatches.filter((m) => m.date.toDate() >= cutoff);
  }, [allMatches, isPremium]);

  const upcomingMatches = useMemo(() => {
    return matches
      .filter((m) => m.scoreHome == null || m.scoreAway == null)
      .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime())
      .slice(0, 10);
  }, [matches]);

  const recentResults = useMemo(() => {
    return matches
      .filter((m) => m.scoreHome != null && m.scoreAway != null)
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
      .slice(0, 10);
  }, [matches]);

  const hasFeatureFn = useCallback(
    (feature: Parameters<typeof hasFeature>[1]) => hasFeature(plan as PlanType, feature),
    [plan]
  );

  return (
    <TeamContext.Provider
      value={{
        user,
        team,
        matches,
        venues,
        players,
        loading,
        authLoading,
        teamId,
        setTeamId,
        upcomingMatches,
        recentResults,
        plan,
        isPremium,
        memberCount,
        hasFeature: hasFeatureFn,
        syncPurchaseState,
        isEmailLinked,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
