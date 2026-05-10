import { Timestamp } from 'firebase/firestore';

export type MatchType = 'practice' | 'official';
export type MatchResult = 'win' | 'loss' | 'draw';
export type MatchStatus = 'upcoming' | 'completed';
export type Plan = 'free' | 'family';

export interface Team {
  id: string;
  name: string;
  shareCode: string;
  createdBy: string;
  memberIds: string[];
  plan: Plan;
  createdAt: Timestamp;
}

export interface Match {
  id: string;
  teamId: string;
  date: Timestamp;
  opponent: string;
  venue: string;
  venueId?: string;
  matchType: MatchType;
  competitionName?: string;
  scoreHome: number | null;
  scoreAway: number | null;
  result: MatchResult | null;
  notes?: string;
  youtubeUrl?: string;
  status: MatchStatus;
  playerIds?: string[];  // 出場予定・出場した選手
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MatchFormData {
  date: Date;
  opponent: string;
  venue: string;
  venueId?: string;
  matchType: MatchType;
  competitionName?: string;
  scoreHome: number | null;
  scoreAway: number | null;
  notes?: string;
  youtubeUrl?: string;
  status: MatchStatus;
  playerIds?: string[];  // 出場予定・出場した選手
}

export interface Venue {
  id: string;
  teamId: string;
  name: string;
  address?: string;
  googleMapsUrl?: string;
  createdAt: Timestamp;
}

export type PlayerPosition =
  | 'GK'
  | 'CB' | 'RSB' | 'LSB'
  | 'ボランチ' | 'CMF' | 'トップ下' | 'RSH' | 'LSH'
  | 'RWG' | 'LWG' | 'CF';

export interface Player {
  id: string;
  teamId: string;
  name: string;
  positions: PlayerPosition[];
  number?: number;
  photoUrl?: string;     // 顔写真（ファミリープラン）
  createdAt: Timestamp;
}

// ファミリープラン：所属チーム履歴
export interface PlayerStep {
  id: string;
  playerId: string;
  teamId: string;
  teamName: string;        // チーム名
  teamIconUrl?: string;    // チームアイコン（Storage URL）
  number?: number;         // 背番号
  positions: PlayerPosition[];
  startDate: Timestamp;    // 所属開始
  endDate?: Timestamp;     // 所属終了（nullなら現在も在籍）
  note?: string;
  createdAt: Timestamp;
}

// ファミリープラン：トレセン歴
export type ToreisenLevel = 'district' | 'city' | 'prefecture' | 'region' | 'national';

export interface ToreisenRecord {
  id: string;
  playerId: string;
  teamId: string;
  level: ToreisenLevel; // 地区〜全国
  levelLabel: string;    // 表示用ラベル（例: "県トレ"）
  year: number;          // 年度
  ageGroup?: string;     // 年代（例: "U-12"）
  note?: string;
  createdAt: Timestamp;
}
