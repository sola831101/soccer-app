import { Match, PlayInterval } from './types';

// 1ハーフの既定の長さ（分）。試合にhalfMinutesが未設定の場合のフォールバック
export const DEFAULT_HALF_MINUTES = 15;

// 出場区間1つの出場分を算出（新形式・旧形式の両方に対応）
export function intervalMinutes(iv: PlayInterval, halfMinutes: number): number {
  // 旧形式（in/out が試合通算分）
  if (iv.in != null || iv.out != null) {
    return Math.max(0, (iv.out ?? 0) - (iv.in ?? 0));
  }
  // 新形式（ハーフ内の経過分。'start'=0, 'end'=halfMinutes）
  const start = iv.start === 'start' || iv.start == null ? 0 : Number(iv.start);
  const end = iv.end === 'end' || iv.end == null ? halfMinutes : Number(iv.end);
  return Math.max(0, end - start);
}

export interface SeasonStats {
  totalMatches: number;
  officialMatches: number;
  practiceMatches: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  winRate: number;
  officialWins: number;
  officialLosses: number;
  officialDraws: number;
  officialGoalsScored: number;
  officialGoalsConceded: number;
  practiceWins: number;
  practiceLosses: number;
  practiceDraws: number;
  practiceGoalsScored: number;
  practiceGoalsConceded: number;
}

/**
 * 日本の年度を取得（4月〜翌3月）
 * 例: 2025年4月〜2026年3月 → 2025年度
 */
export function getFiscalYear(date: Date): number {
  const month = date.getMonth(); // 0-indexed (0=Jan, 3=Apr)
  const year = date.getFullYear();
  return month >= 3 ? year : year - 1;
}

/**
 * 年度の開始日・終了日を取得
 */
export function getFiscalYearRange(fiscalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(fiscalYear, 3, 1),              // 4月1日
    end: new Date(fiscalYear + 1, 2, 31, 23, 59, 59), // 翌年3月31日
  };
}

/**
 * 試合データから利用可能な年度一覧を取得（降順）
 */
export function getAvailableFiscalYears(matches: Match[]): number[] {
  const years = new Set<number>();
  for (const match of matches) {
    if (match.status === 'completed') {
      years.add(getFiscalYear(match.date.toDate()));
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * 試合データから統計情報を計算
 */
export function computeStats(matches: Match[], fiscalYear?: number): SeasonStats {
  let filtered = matches.filter((m) => m.status === 'completed');

  if (fiscalYear !== undefined) {
    const { start, end } = getFiscalYearRange(fiscalYear);
    filtered = filtered.filter((m) => {
      const d = m.date.toDate();
      return d >= start && d <= end;
    });
  }

  const stats: SeasonStats = {
    totalMatches: filtered.length,
    officialMatches: 0,
    practiceMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    goalsScored: 0,
    goalsConceded: 0,
    goalDifference: 0,
    winRate: 0,
    officialWins: 0,
    officialLosses: 0,
    officialDraws: 0,
    officialGoalsScored: 0,
    officialGoalsConceded: 0,
    practiceWins: 0,
    practiceLosses: 0,
    practiceDraws: 0,
    practiceGoalsScored: 0,
    practiceGoalsConceded: 0,
  };

  for (const match of filtered) {
    const isOfficial = match.matchType === 'official';
    if (isOfficial) stats.officialMatches++;
    else stats.practiceMatches++;

    if (match.result === 'win') {
      stats.wins++;
      if (isOfficial) stats.officialWins++;
      else stats.practiceWins++;
    } else if (match.result === 'loss') {
      stats.losses++;
      if (isOfficial) stats.officialLosses++;
      else stats.practiceLosses++;
    } else if (match.result === 'draw') {
      stats.draws++;
      if (isOfficial) stats.officialDraws++;
      else stats.practiceDraws++;
    }

    const scored = match.scoreHome ?? 0;
    const conceded = match.scoreAway ?? 0;
    stats.goalsScored += scored;
    stats.goalsConceded += conceded;
    if (isOfficial) {
      stats.officialGoalsScored += scored;
      stats.officialGoalsConceded += conceded;
    } else {
      stats.practiceGoalsScored += scored;
      stats.practiceGoalsConceded += conceded;
    }
  }

  stats.goalDifference = stats.goalsScored - stats.goalsConceded;
  stats.winRate =
    stats.totalMatches > 0
      ? Math.round((stats.wins / stats.totalMatches) * 100)
      : 0;

  return stats;
}

export interface OpponentRecord {
  opponent: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsConceded: number;
}

/**
 * 対戦チームごとの成績を計算
 */
export function computeOpponentStats(matches: Match[], fiscalYear?: number): OpponentRecord[] {
  let filtered = matches.filter((m) => m.status === 'completed');

  if (fiscalYear !== undefined) {
    const { start, end } = getFiscalYearRange(fiscalYear);
    filtered = filtered.filter((m) => {
      const d = m.date.toDate();
      return d >= start && d <= end;
    });
  }

  const map = new Map<string, OpponentRecord>();

  for (const match of filtered) {
    const name = match.opponent.trim();
    if (!name) continue;

    let record = map.get(name);
    if (!record) {
      record = { opponent: name, matches: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsConceded: 0 };
      map.set(name, record);
    }

    record.matches++;
    if (match.result === 'win') record.wins++;
    else if (match.result === 'loss') record.losses++;
    else if (match.result === 'draw') record.draws++;

    record.goalsScored += match.scoreHome ?? 0;
    record.goalsConceded += match.scoreAway ?? 0;
  }

  return Array.from(map.values()).sort((a, b) => b.matches - a.matches);
}

// --- 選手スタッツ（ファミリー：得点・アシスト・出場） ---

export interface PlayerTotals {
  matches: number; // 出場数（status==='completed'）
  goals: number;
  assists: number;
  clears: number; // ブロック数
  minutes: number; // 合計出場時間（分）
}

export interface PlayerStatLine extends PlayerTotals {
  playerId: string;
  name: string;
  number?: number;
}

/**
 * 試合配列から1選手の累計を集計（内部共通処理）。
 * 出場数は完了済み試合のみ。得点・アシスト・クリアは記録(playerStats)から集計。
 */
function sumPlayerStats(matches: Match[], playerId: string): PlayerTotals {
  let played = 0;
  let goals = 0;
  let assists = 0;
  let clears = 0;
  let minutes = 0;
  for (const m of matches) {
    if (m.status === 'completed') played++;
    const s = m.playerStats?.[playerId];
    if (s) {
      goals += s.goals ?? 0;
      assists += s.assists ?? 0;
      clears += s.clears ?? 0;
      for (const iv of s.intervals ?? []) {
        minutes += intervalMinutes(iv, m.halfMinutes ?? DEFAULT_HALF_MINUTES);
      }
    }
  }
  return { matches: played, goals, assists, clears, minutes };
}

/**
 * 選手が出場した試合（playerIdsに含まれる）を抽出。fiscalYear指定で年度フィルタ。
 */
function playerMatches(matches: Match[], playerId: string, fiscalYear?: number): Match[] {
  let filtered = matches.filter((m) => (m.playerIds ?? []).includes(playerId));
  if (fiscalYear !== undefined) {
    const { start, end } = getFiscalYearRange(fiscalYear);
    filtered = filtered.filter((m) => {
      const d = m.date.toDate();
      return d >= start && d <= end;
    });
  }
  return filtered;
}

/**
 * 1選手の累計（出場数・得点・アシスト・クリア）。fiscalYear指定で年度フィルタ。
 */
export function computePlayerTotals(
  matches: Match[],
  playerId: string,
  fiscalYear?: number
): PlayerTotals {
  return sumPlayerStats(playerMatches(matches, playerId, fiscalYear), playerId);
}

/**
 * 1選手の公式戦／練習試合の内訳累計。
 */
export function computePlayerSplit(
  matches: Match[],
  playerId: string,
  fiscalYear?: number
): { official: PlayerTotals; practice: PlayerTotals } {
  const filtered = playerMatches(matches, playerId, fiscalYear);
  return {
    official: sumPlayerStats(filtered.filter((m) => m.matchType === 'official'), playerId),
    practice: sumPlayerStats(filtered.filter((m) => m.matchType !== 'official'), playerId),
  };
}

/**
 * 1選手の年度別累計（年度降順）。出場のある年度のみ。
 */
export function computePlayerYearlyTotals(
  matches: Match[],
  playerId: string
): { fiscalYear: number; totals: PlayerTotals }[] {
  const filtered = playerMatches(matches, playerId);
  const years = new Set<number>();
  for (const m of filtered) years.add(getFiscalYear(m.date.toDate()));
  return Array.from(years)
    .sort((a, b) => b - a)
    .map((fy) => ({ fiscalYear: fy, totals: computePlayerTotals(matches, playerId, fy) }));
}

/**
 * 全選手のスタッツ一覧（得点降順 → アシスト降順 → クリア降順 → 出場降順）
 */
export function computePlayerStatLines(
  matches: Match[],
  players: { id: string; name: string; number?: number }[],
  fiscalYear?: number
): PlayerStatLine[] {
  return players
    .map((p) => {
      const t = computePlayerTotals(matches, p.id, fiscalYear);
      return { playerId: p.id, name: p.name, number: p.number, ...t };
    })
    .sort(
      (a, b) =>
        b.goals - a.goals || b.assists - a.assists || b.clears - a.clears || b.matches - a.matches
    );
}
