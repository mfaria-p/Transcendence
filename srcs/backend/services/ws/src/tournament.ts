import crypto from 'node:crypto';

export type TournamentStatus = 'waiting' | 'running' | 'finished';
export type MatchStatus = 'pending' | 'playing' | 'finished';

export interface TournamentMatch {
  id: string;
  roomId: string;
  player1Id: string | null;
  player2Id: string | null;
  status: MatchStatus;
  winnerId?: string;
  sourceMatch1Id?: string;
  sourceMatch2Id?: string;
  isFinal?: boolean;
}

export interface Tournament {
  id: string;
  name?: string;
  ownerId: string;
  maxPlayers: number;
  status: TournamentStatus;
  players: string[];
  matches: TournamentMatch[];
  winnerId?: string;
  createdAt: number;
  updatedAt: number;
}

// Storage em memória
const tournaments = new Map<string, Tournament>();
// Map roomId -> (tournamentId, matchId)
const roomToTournament = new Map<string, { tournamentId: string; matchId: string }>();

function now(): number {
  return Date.now();
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function listTournaments(): Tournament[] {
  return Array.from(tournaments.values());
}

export function getTournament(id: string): Tournament | undefined {
  return tournaments.get(id);
}

export function createTournament(input: {
  ownerId: string;
  name?: string;
  maxPlayers?: number;
}): Tournament {
  const maxPlayers =
    typeof input.maxPlayers === 'number' && input.maxPlayers > 1 ? input.maxPlayers : 4;

  const t: Tournament = {
    id: genId('t'),
    ownerId: input.ownerId,
    maxPlayers,
    status: 'waiting',
    players: [input.ownerId],
    matches: [],
    createdAt: now(),
    updatedAt: now(),
  };

  if (input.name !== undefined) {
    t.name = input.name;
  }

  tournaments.set(t.id, t);
  return t;
}

export function joinTournament(tournamentId: string, userId: string): Tournament {
  const t = tournaments.get(tournamentId);
  if (!t) {
    throw new Error('Tournament not found');
  }
  if (t.status !== 'waiting') {
    throw new Error('Tournament already started');
  }
  if (t.players.includes(userId)) {
    return t;
  }
  if (t.players.length >= t.maxPlayers) {
    throw new Error('Tournament full');
  }

  t.players.push(userId);
  t.updatedAt = now();
  return t;
}

function createMatch(
  t: Tournament,
  opts: {
    player1Id?: string | null;
    player2Id?: string | null;
    isFinal?: boolean;
    sourceMatch1Id?: string;
    sourceMatch2Id?: string;
  },
  matches: TournamentMatch[],
): TournamentMatch {
  const matchId = genId('m');
  const roomId = `room_${t.id}_${matchId}`;

  const match: TournamentMatch = {
    id: matchId,
    roomId,
    player1Id: opts.player1Id ?? null,
    player2Id: opts.player2Id ?? null,
    status: 'pending',
  };

  if (opts.isFinal !== undefined) {
    match.isFinal = opts.isFinal;
  }
  if (opts.sourceMatch1Id !== undefined) {
    match.sourceMatch1Id = opts.sourceMatch1Id;
  }
  if (opts.sourceMatch2Id !== undefined) {
    match.sourceMatch2Id = opts.sourceMatch2Id;
  }

  matches.push(match);
  roomToTournament.set(roomId, { tournamentId: t.id, matchId });
  return match;
}

/**
 * Gera um bracket completo para N jogadores, onde N é potência de 2:
 * 2, 4, 8, 16, ...
 *
 * Regras:
 * - Não há byes.
 * - Usa a ordem atual de t.players (se quiseres, podes baralhar antes).
 */
export function startTournament(tournamentId: string): Tournament {
  const t = tournaments.get(tournamentId);
  if (!t) {
    throw new Error('Tournament not found');
  }
  if (t.status !== 'waiting') {
    throw new Error('Tournament already started');
  }

  const playerCount = t.players.length;

  if (playerCount < 2) {
    throw new Error('Not enough players (need at least 2)');
  }
  if (!isPowerOfTwo(playerCount)) {
    throw new Error(
      'Tournament must start with a number of players that is a power of 2 (2, 4, 8, 16, ...)',
    );
  }

  // Se quiseres randomizar os confrontos:
  // const players = [...t.players].sort(() => Math.random() - 0.5);
  const players = [...t.players];

  const matches: TournamentMatch[] = [];

  // Round 1 (players diretos)
  let prevRound: TournamentMatch[] = [];
  for (let i = 0; i < playerCount; i += 2) {
    const m = createMatch(
      t,
      {
        player1Id: players[i] ?? null,
        player2Id: players[i + 1] ?? null,
      },
      matches,
    );
    prevRound.push(m);
  }

  // Rounds seguintes (dependem dos winners)
  while (prevRound.length > 1) {
    const nextRound: TournamentMatch[] = [];
    const nextIsFinal = prevRound.length === 2;

    for (let i = 0; i < prevRound.length; i += 2) {
      const a = prevRound[i];
      const b = prevRound[i + 1];

      const m = createMatch(
        t,
        {
          isFinal: nextIsFinal ? true : undefined,
          sourceMatch1Id: a.id,
          sourceMatch2Id: b.id,
        },
        matches,
      );
      nextRound.push(m);
    }

    prevRound = nextRound;
  }

  t.matches = matches;
  t.status = 'running';
  t.updatedAt = now();
  return t;
}

export function getMatchByRoomId(
  roomId: string,
): { tournament: Tournament; match: TournamentMatch } | undefined {
  const link = roomToTournament.get(roomId);
  if (!link) return undefined;

  const t = tournaments.get(link.tournamentId);
  if (!t) return undefined;

  const match = t.matches.find((m) => m.id === link.matchId);
  if (!match) return undefined;

  return { tournament: t, match };
}

/**
 * Atualiza winner + avança a árvore.
 * - Se o match é final: fecha torneio.
 * - Caso contrário: coloca o winner no match pai (onde sourceMatch1Id/2Id apontam).
 */
export function reportMatchResultByRoomId(
  roomId: string,
  winnerId: string,
):
  | {
      tournament: Tournament;
      match: TournamentMatch;
      finalMatch?: TournamentMatch;
    }
  | undefined {
  const info = getMatchByRoomId(roomId);
  if (!info) return undefined;

  const { tournament, match } = info;

  if (match.status === 'finished') {
    return { tournament, match };
  }

  match.status = 'finished';
  match.winnerId = winnerId;
  tournament.updatedAt = now();

  let finalMatch: TournamentMatch | undefined;

  if (match.isFinal) {
    tournament.status = 'finished';
    tournament.winnerId = winnerId;
  } else {
    for (const m of tournament.matches) {
      if (m.sourceMatch1Id === match.id) {
        m.player1Id = winnerId;
        finalMatch = m;
      } else if (m.sourceMatch2Id === match.id) {
        m.player2Id = winnerId;
        finalMatch = m;
      }
    }
  }

  if (finalMatch) return { tournament, match, finalMatch };
  return { tournament, match };
}
