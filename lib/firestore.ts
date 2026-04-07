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
} from 'firebase/firestore';
import { db } from './firebase';
import { Match, MatchFormData, Team, Venue, Player, PlayerPosition } from './types';

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- Team ---

export async function createTeam(name: string, userId: string): Promise<Team> {
  let shareCode = generateShareCode();

  // コード重複チェック
  const existing = await getDocs(
    query(collection(db, 'teams'), where('shareCode', '==', shareCode))
  );
  if (!existing.empty) {
    shareCode = generateShareCode();
  }

  const teamData = {
    name,
    shareCode,
    createdBy: userId,
    memberIds: [userId],
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, 'teams'), teamData);
  return { id: docRef.id, ...teamData };
}

export async function joinTeam(shareCode: string, userId: string): Promise<Team | null> {
  const q = query(collection(db, 'teams'), where('shareCode', '==', shareCode.toUpperCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const teamDoc = snapshot.docs[0];
  const teamData = teamDoc.data();

  if (!teamData.memberIds.includes(userId)) {
    await updateDoc(doc(db, 'teams', teamDoc.id), {
      memberIds: arrayUnion(userId),
    });
  }

  return { id: teamDoc.id, ...teamData } as Team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const teamDoc = await getDoc(doc(db, 'teams', teamId));
  if (!teamDoc.exists()) return null;
  return { id: teamDoc.id, ...teamDoc.data() } as Team;
}

export async function updateTeamName(teamId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { name });
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
