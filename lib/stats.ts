import { Match } from './types';

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
