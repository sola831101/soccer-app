import { Timestamp } from 'firebase/firestore';

export type MatchType = 'practice' | 'official';
export type MatchResult = 'win' | 'loss' | 'draw';
export type MatchStatus = 'upcoming' | 'completed';

export interface Team {
  id: string;
  name: string;
  shareCode: string;
  createdBy: string;
  memberIds: string[];
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
  createdAt: Timestamp;
}
