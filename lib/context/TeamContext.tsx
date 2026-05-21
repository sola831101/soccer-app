import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { Team, Match, Venue, Player, Plan } from '../types';
import { subscribeToTeam, subscribeToMatches, subscribeToVenues, subscribeToPlayers, updateTeamPlan } from '../firestore';
import { PLAN_LIMITS, hasFeature, Plan as PlanType } from '../plans';
import { configurePurchases, getCustomerInfo, getPremiumStatus } from '../purchases';

export type SyncState = 'idle' | 'syncing' | 'error';

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
  // 手動同期用: 結果を返す（成功 or エラー）。ボタンUIでローディング/エラー表示するために使う
  syncPurchaseStateManual: () => Promise<{ ok: boolean; error?: string }>;
  syncState: SyncState;
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
  syncPurchaseStateManual: async () => ({ ok: false, error: 'not initialized' }),
  syncState: 'idle',
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
  // RevenueCat 設定完了フラグ。configurePurchases完了前にsyncが走るレース条件を防ぐ。
  const [purchasesReady, setPurchasesReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  // syncロジック内で最新のteam/userを参照するためのref（useCallbackのdeps肥大化を避ける）
  const teamRef = useRef<Team | null>(null);
  const userRef = useRef<User | null>(null);

  const setTeamId = useCallback(async (id: string | null) => {
    setTeamIdState(id);
    if (id) {
      await AsyncStorage.setItem(TEAM_ID_KEY, id);
    } else {
      await AsyncStorage.removeItem(TEAM_ID_KEY);
    }
  }, []);

  // Auth状態監視
  // セッション復元失敗時 (firebaseUser=null) は新匿名認証を行わない。
  // _layout.tsx / (tabs)/_layout.tsx のリダイレクトで onboarding へ誘導され、
  // ユーザーは既存メアド入力でverifyOTP経由で旧UIDに復帰できる（新規ユーザーも同様にメール登録）。
  // これにより新匿名UIDが発行されず、memberIdsにゴミUIDが残らない。
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        try {
          await configurePurchases(firebaseUser.uid);
          setPurchasesReady(true);
        } catch (e) {
          console.warn('[Purchases] configure error:', e);
          setPurchasesReady(false);
        }
      } else {
        setPurchasesReady(false);
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

  // team/userを常に最新でrefに反映（syncロジックがdepsに含めずに参照するため）
  useEffect(() => {
    teamRef.current = team;
  }, [team]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // sync本体: RevenueCat → Firestore反映。誤動作を避けるため厳格に判定。
  // - active かつ family でない → family へアップグレード
  // - expired かつ family の場合のみ → free へダウングレード
  // - customerInfo取得失敗 → 何もしない（既存状態維持、呼び出し元にerror返却）
  // - team未ロード時はアップグレード/ダウングレード共にスキップ（誤動作防止）
  // - オーナー以外はFirestoreルールでplan更新が拒否されるため、リトライ前に黙ってスキップ
  const syncPurchaseStateCore = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!teamId) return { ok: false, error: 'no team' };

    const currentTeam = teamRef.current;
    const currentUser = userRef.current;

    // teamが未ロード時は何もしない。次回起動 or team購読の初回snapshot後に再syncに委ねる
    if (!currentTeam) {
      return { ok: true };
    }
    // オーナー (createdBy) 以外はFirestoreルールで plan 更新が permission-denied になる。
    // 静かにスキップして、無駄なリトライ・ログ汚染・APIコール消費を避ける。
    // メンバーが自前の課金を持ち込んだケースは現時点では手動サポート対応とする（1.0.12では非対応）。
    if (currentUser && currentTeam.createdBy !== currentUser.uid) {
      return { ok: true };
    }

    try {
      const customerInfo = await getCustomerInfo();
      if (!customerInfo) {
        return { ok: false, error: 'customer info unavailable' };
      }
      const status = getPremiumStatus(customerInfo);
      const currentPlan = currentTeam.plan; // undefined ならplanフィールド未設定

      if (status === 'active' && currentPlan !== 'family') {
        await updateTeamPlan(teamId, 'family');
      } else if (status === 'expired' && currentPlan === 'family') {
        await updateTeamPlan(teamId, 'free');
      }
      // status==='never' はチームに対する課金履歴なし → 触らない
      return { ok: true };
    } catch (e) {
      console.error('[Purchases] syncPurchaseStateCore error:', e);
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [teamId]);

  // 起動時の自動同期: team購読・purchasesReady揃ってからretry付きで実行（最大3回、1s/3s/9sバックオフ）
  // user は idToken refresh 等でインスタンスが変わりうるので uid を依存に。teamも初回ロードのみtriggerする。
  const teamLoaded = !!team;
  const uid = user?.uid;
  useEffect(() => {
    if (!teamId || !uid || !purchasesReady || !teamLoaded) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryOnce = async (attempt: number) => {
      if (cancelled) return;
      setSyncState('syncing');
      const result = await syncPurchaseStateCore();
      if (cancelled) return;

      if (result.ok) {
        setSyncState('idle');
        return;
      }

      const maxAttempts = 3;
      const nextAttempt = attempt + 1;
      if (nextAttempt >= maxAttempts) {
        console.warn('[Purchases] auto-sync failed after retries:', result.error);
        setSyncState('error');
        return;
      }
      const backoff = [1000, 3000, 9000];
      timeoutId = setTimeout(() => tryOnce(nextAttempt), backoff[attempt] ?? 9000);
    };

    tryOnce(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [teamId, uid, purchasesReady, teamLoaded, syncPurchaseStateCore]);

  // 手動同期: 設定>プラン画面の「購入状態を同期」ボタンから呼ばれる
  const syncPurchaseStateManual = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setSyncState('syncing');
    const result = await syncPurchaseStateCore();
    setSyncState(result.ok ? 'idle' : 'error');
    return result;
  }, [syncPurchaseStateCore]);

  // 互換API: UpgradeModal等の「購入完了直後にfamilyを即時セット」用途
  // 引数あり: その値で強制セット / 引数なし: 自動syncに委譲
  const syncPurchaseState = useCallback(async (newPlan?: PlanType) => {
    if (!teamId) return;
    try {
      if (newPlan) {
        await updateTeamPlan(teamId, newPlan);
        return;
      }
      await syncPurchaseStateCore();
    } catch (e) {
      console.error('[Purchases] syncPurchaseState error:', e);
    }
  }, [teamId, syncPurchaseStateCore]);

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
        syncPurchaseStateManual,
        syncState,
        isEmailLinked,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
