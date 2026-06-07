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

// 出場区間
// 新形式: 前半/後半ごとに「スタメン(開始から) or ○分から」「最後まで or ○分まで」を記録。
//   half=1(前半)/2(後半)。start/end は 'start'/'end'(=ハーフの端)または分(number)。
//   ハーフ内の経過分で表す（後半5分から=後半の5分地点）。試合のhalfMinutesで終端を計算。
// 旧形式(後方互換): in/out を分(試合通算)で持つ既存データも読めるようにする。
export interface PlayInterval {
  half?: 1 | 2;
  start?: 'start' | number;
  end?: 'end' | number;
  // --- 旧形式（後方互換・新規書き込みはしない） ---
  in?: number;
  out?: number;
}

// ファミリープラン：1試合あたりの選手スタッツ
export interface PlayerMatchStat {
  goals: number;
  assists: number;
  clears: number;            // ブロック数（守備指標。多少のブレ許容）
  intervals?: PlayInterval[]; // 出場区間（出入り自由）
  note?: string;
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
  halfMinutes?: number;  // 1ハーフの長さ（分）。出場時間の「最後まで」計算に使用。未設定時は既定値
  playerIds?: string[];  // 出場予定・出場した選手
  playerStats?: { [playerId: string]: PlayerMatchStat }; // ファミリー：選手ごとの得点・アシスト
  photos?: string[];     // 試合の写真（Storage URL配列）
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
  halfMinutes?: number;  // 1ハーフの長さ（分）
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
