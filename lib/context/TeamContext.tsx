import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { Team, Match, Venue, Player } from '../types';
import { subscribeToTeam, subscribeToMatches, subscribeToVenues, subscribeToPlayers } from '../firestore';

interface TeamContextType {
  user: User | null;
  team: Team | null;
  matches: Match[];
  venues: Venue[];
  players: Player[];
  loading: boolean;
  teamId: string | null;
  setTeamId: (id: string | null) => void;
  upcomingMatches: Match[];
  recentResults: Match[];
}

const TeamContext = createContext<TeamContextType>({
  user: null,
  team: null,
  matches: [],
  venues: [],
  players: [],
  loading: true,
  teamId: null,
  setTeamId: () => {},
  upcomingMatches: [],
  recentResults: [],
});

export function useTeam() {
  return useContext(TeamContext);
}

const TEAM_ID_KEY = 'soccer_app_team_id';

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamIdState] = useState<string | null>(null);

  const setTeamId = useCallback(async (id: string | null) => {
    setTeamIdState(id);
    if (id) {
      await AsyncStorage.setItem(TEAM_ID_KEY, id);
    } else {
      await AsyncStorage.removeItem(TEAM_ID_KEY);
    }
  }, []);

  // Anonymous Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
      } else {
        const result = await signInAnonymously(auth);
        setUser(result.user);
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

  // Subscribe to team（user が確定してから購読開始）
  useEffect(() => {
    if (!teamId || !user) {
      if (!teamId) {
        setTeam(null);
        setMatches([]);
        setVenues([]);
        setPlayers([]);
      }
      return;
    }

    const unsubTeam = subscribeToTeam(teamId, setTeam);
    const unsubMatches = subscribeToMatches(teamId, setMatches);
    const unsubVenues = subscribeToVenues(teamId, setVenues);
    const unsubPlayers = subscribeToPlayers(teamId, setPlayers);

    return () => {
      unsubTeam();
      unsubMatches();
      unsubVenues();
      unsubPlayers();
    };
  }, [teamId, user]);

  // スコア有無で振り分け（statusフィールドに依存しない）
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

  return (
    <TeamContext.Provider
      value={{
        user,
        team,
        matches,
        venues,
        players,
        loading,
        teamId,
        setTeamId,
        upcomingMatches,
        recentResults,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
