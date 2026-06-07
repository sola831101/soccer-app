import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
  getDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import { Match, MatchFormData, Team, Venue, Player, PlayerPosition, Plan, PlayerStep, ToreisenRecord, ToreisenLevel, PlayInterval } from './types';
import { PLAN_LIMITS } from './plans';

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueCode(field: 'shareCode' | 'coachShareCode' = 'shareCode'): Promise<string> {
  let code = generateShareCode();
  const existing = await getDocs(
    query(collection(db, 'teams'), where(field, '==', code))
  );
  if (!existing.empty) code = generateShareCode();
  return code;
}

// --- Team ---

export async function getUserTeams(userId: string): Promise<Team[]> {
  const snapshot = await getDocs(
    query(collection(db, 'teams'), where('memberIds', 'array-contains', userId))
  );
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team));
}

export async function createTeam(name: string, userId: string): Promise<Team> {
  const shareCode = await generateUniqueCode('shareCode');
  const teamData = {
    name,
    shareCode,
    createdBy: userId,
    memberIds: [userId],
    plan: 'free' as const,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, 'teams'), teamData);
  return { id: docRef.id, ...teamData };
}

export async function joinTeam(shareCode: string, userId: string): Promise<Team | null> {
  const code = shareCode.toUpperCase();
  const snapshot = await getDocs(
    query(collection(db, 'teams'), where('shareCode', '==', code))
  );
  if (snapshot.empty) return null;

  const teamDoc = snapshot.docs[0];
  const teamData = teamDoc.data();

  // 新規参加の場合のみメンバー数制限チェック（Firestore追加前に実施）
  if (!teamData.memberIds.includes(userId)) {
    const plan = (teamData.plan ?? 'free') as Plan;
    const memberLimit = PLAN_LIMITS[plan]?.members ?? PLAN_LIMITS.free.members;
    if (teamData.memberIds.length >= memberLimit) {
      const err = new Error(`このチームはメンバーが上限（${memberLimit}人）に達しています。`) as any;
      err.code = 'MEMBER_LIMIT_EXCEEDED';
      err.memberLimit = memberLimit;
      throw err;
    }
    await updateDoc(doc(db, 'teams', teamDoc.id), {
      memberIds: arrayUnion(userId),
    });
  }

  return { id: teamDoc.id, ...teamData } as Team;
}

export async function updatePlayerPhoto(teamId: string, playerId: string, photoUrl: string | null): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { photoUrl: photoUrl ?? null });
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const teamDoc = await getDoc(doc(db, 'teams', teamId));
  if (!teamDoc.exists()) return null;
  return { id: teamDoc.id, ...teamDoc.data() } as Team;
}

export async function updateTeamName(teamId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { name });
}

export async function updateTeamPlan(teamId: string, plan: Plan): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { plan });
}

// 後方互換のため残す
export async function upgradeToPremium(teamId: string): Promise<void> {
  await updateTeamPlan(teamId, 'family');
}

export async function downgradeToFree(teamId: string): Promise<void> {
  await updateTeamPlan(teamId, 'free');
}

export function subscribeToTeam(teamId: string, callback: (team: Team | null) => void) {
  return onSnapshot(doc(db, 'teams', teamId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...snapshot.data() } as Team);
  }, (error) => {
    console.error('[Firestore] subscribeToTeam error:', error.code, error.message);
  });
}

// --- Matches ---

function buildMatchData(data: MatchFormData) {
  return {
    date: Timestamp.fromDate(data.date),
    opponent: data.opponent,
    venue: data.venue,
    venueId: data.venueId || null,
    matchType: data.matchType,
    competitionName: data.competitionName || null,
    scoreHome: data.scoreHome,
    scoreAway: data.scoreAway,
    result: computeResult(data.scoreHome, data.scoreAway),
    notes: data.notes || null,
    youtubeUrl: data.youtubeUrl || null,
    status: data.status,
    halfMinutes: data.halfMinutes ?? 15,
    playerIds: data.playerIds ?? [],
  };
}

export async function createMatch(teamId: string, data: MatchFormData): Promise<string> {
  const matchData = {
    teamId,
    ...buildMatchData(data),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, 'teams', teamId, 'matches'), matchData);
  return docRef.id;
}

export async function updateMatch(teamId: string, matchId: string, data: MatchFormData): Promise<void> {
  const updateData = {
    ...buildMatchData(data),
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, 'teams', teamId, 'matches', matchId), updateData);
}

export async function deleteMatch(teamId: string, matchId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'matches', matchId));
}

// ファミリー：選手ごとの得点・アシスト（メモ）をまとめて保存。
// 引数のマップで playerStats フィールドを丸ごと置き換える（noteは空なら呼び出し側で除外済み想定）。
export async function updateMatchPlayerStats(
  teamId: string,
  matchId: string,
  playerStats: {
    [playerId: string]: {
      goals: number;
      assists: number;
      clears: number;
      intervals?: PlayInterval[];
      note?: string;
    };
  }
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'matches', matchId), {
    playerStats,
    updatedAt: Timestamp.now(),
  });
}

export async function addMatchPhoto(teamId: string, matchId: string, url: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'matches', matchId), {
    photos: arrayUnion(url),
    updatedAt: Timestamp.now(),
  });
}

export async function removeMatchPhoto(teamId: string, matchId: string, url: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'matches', matchId), {
    photos: arrayRemove(url),
    updatedAt: Timestamp.now(),
  });
}

export function subscribeToMatches(
  teamId: string,
  callback: (matches: Match[]) => void
) {
  const q = query(
    collection(db, 'teams', teamId, 'matches'),
    orderBy('date', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Match[];
    callback(matches);
  }, (error) => {
    console.error('[Firestore] subscribeToMatches error:', error.code, error.message);
  });
}

function computeResult(
  scoreHome: number | null | undefined,
  scoreAway: number | null | undefined
): 'win' | 'loss' | 'draw' | null {
  if (scoreHome == null || scoreAway == null) return null;
  if (scoreHome > scoreAway) return 'win';
  if (scoreHome < scoreAway) return 'loss';
  return 'draw';
}

// --- Venues ---

export async function createVenue(
  teamId: string,
  data: { name: string; address?: string; googleMapsUrl?: string }
): Promise<Venue> {
  const venueData = {
    teamId,
    name: data.name,
    address: data.address || null,
    googleMapsUrl: data.googleMapsUrl || null,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, 'teams', teamId, 'venues'), venueData);
  return { id: docRef.id, ...venueData } as Venue;
}

export async function updateVenue(
  teamId: string,
  venueId: string,
  data: { name?: string; address?: string; googleMapsUrl?: string }
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.googleMapsUrl !== undefined) updateData.googleMapsUrl = data.googleMapsUrl || null;
  await updateDoc(doc(db, 'teams', teamId, 'venues', venueId), updateData);
}

export async function deleteVenue(teamId: string, venueId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'venues', venueId));
}

export function subscribeToVenues(
  teamId: string,
  callback: (venues: Venue[]) => void
) {
  const q = query(
    collection(db, 'teams', teamId, 'venues'),
    orderBy('name', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const venues = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Venue[];
    callback(venues);
  }, (error) => {
    console.error('[Firestore] subscribeToVenues error:', error.code, error.message);
  });
}

// --- Players ---

export async function createPlayer(
  teamId: string,
  data: { name: string; positions: PlayerPosition[]; number?: number }
): Promise<Player> {
  const playerData = {
    teamId,
    name: data.name,
    positions: data.positions,
    number: data.number ?? null,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(collection(db, 'teams', teamId, 'players'), playerData);
  return { id: docRef.id, ...playerData } as Player;
}

export async function updatePlayer(
  teamId: string,
  playerId: string,
  data: { name?: string; positions?: PlayerPosition[]; number?: number | null }
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), data);
}

export async function deletePlayer(teamId: string, playerId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'players', playerId));
}

export function subscribeToPlayers(
  teamId: string,
  callback: (players: Player[]) => void
) {
  const q = query(
    collection(db, 'teams', teamId, 'players'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const players = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Player[];
    callback(players);
  }, (error) => {
    console.error('[Firestore] subscribeToPlayers error:', error.code, error.message);
  });
}

// --- Player Steps（ファミリープラン：子どもの所属履歴）---

export async function createPlayerStep(
  teamId: string,
  playerId: string,
  data: {
    teamName: string;
    number?: number;
    positions: PlayerPosition[];
    startDate: Date;
    endDate?: Date;
    note?: string;
  }
): Promise<PlayerStep> {
  const stepData = {
    playerId,
    teamId,
    teamName: data.teamName,
    number: data.number ?? null,
    positions: data.positions,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
    note: data.note || null,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(
    collection(db, 'teams', teamId, 'players', playerId, 'steps'),
    stepData
  );
  return { id: docRef.id, ...stepData } as PlayerStep;
}

export async function updatePlayerStep(
  teamId: string,
  playerId: string,
  stepId: string,
  data: {
    teamName?: string;
    number?: number | null;
    positions?: PlayerPosition[];
    startDate?: Date;
    endDate?: Date | null;
    note?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.teamName !== undefined) updateData.teamName = data.teamName;
  if (data.number !== undefined) updateData.number = data.number;
  if (data.positions !== undefined) updateData.positions = data.positions;
  if (data.startDate !== undefined) updateData.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? Timestamp.fromDate(data.endDate) : null;
  if (data.note !== undefined) updateData.note = data.note || null;
  await updateDoc(
    doc(db, 'teams', teamId, 'players', playerId, 'steps', stepId),
    updateData
  );
}

export async function deletePlayerStep(
  teamId: string,
  playerId: string,
  stepId: string
): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'players', playerId, 'steps', stepId));
}

export function subscribeToPlayerSteps(
  teamId: string,
  playerId: string,
  callback: (steps: PlayerStep[]) => void
) {
  const q = query(
    collection(db, 'teams', teamId, 'players', playerId, 'steps'),
    orderBy('startDate', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const steps = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as PlayerStep[];
    callback(steps);
  }, (error) => {
    console.error('[Firestore] subscribeToPlayerSteps error:', error.code, error.message);
  });
}

// --- Toreisen（トレセン歴）---

export async function createToreisenRecord(
  teamId: string,
  playerId: string,
  data: {
    level: ToreisenRecord['level'];
    levelLabel: string;
    year: number;
    ageGroup?: string;
    note?: string;
  }
): Promise<ToreisenRecord> {
  const record = {
    playerId,
    teamId,
    level: data.level,
    levelLabel: data.levelLabel,
    year: data.year,
    ageGroup: data.ageGroup ?? null,
    note: data.note ?? null,
    createdAt: Timestamp.now(),
  };
  const docRef = await addDoc(
    collection(db, 'teams', teamId, 'players', playerId, 'toreisen'),
    record
  );
  return { id: docRef.id, ...record } as ToreisenRecord;
}

export async function updateToreisenRecord(
  teamId: string,
  playerId: string,
  recordId: string,
  data: {
    level: ToreisenRecord['level'];
    levelLabel: string;
    year: number;
    ageGroup?: string;
    note?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'toreisen', recordId), {
    level: data.level,
    levelLabel: data.levelLabel,
    year: data.year,
    ageGroup: data.ageGroup ?? null,
    note: data.note ?? null,
  });
}

export async function deleteToreisenRecord(
  teamId: string,
  playerId: string,
  recordId: string
): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'players', playerId, 'toreisen', recordId));
}

export function subscribeToToreisenRecords(
  teamId: string,
  playerId: string,
  callback: (records: ToreisenRecord[]) => void
) {
  const q = query(
    collection(db, 'teams', teamId, 'players', playerId, 'toreisen'),
    orderBy('year', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ToreisenRecord[];
    callback(records);
  }, (error) => {
    console.error('[Firestore] subscribeToToreisenRecords error:', error.code, error.message);
  });
}
