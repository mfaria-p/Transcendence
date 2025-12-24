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

// Armazenamento em memória
const tournaments = new Map<string, Tournament>();
// Map roomId -> (tournamentId, matchId)
const roomToTournament = new Map<string, { tournamentId: string; matchId: string }>();

function now(): number {
  return Date.now();
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function listTournaments(): Tournament[] {
  return Array.from(tournaments.values()).sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
  );
}

export function getTournament(id: string): Tournament | undefined {
  return tournaments.get(id);
}

export function createTournament(input: {
  ownerId: string;
  name?: string;
  maxPlayers?: number;
}): Tournament {
  const maxPlayers = input.maxPlayers && input.maxPlayers > 1 ? input.maxPlayers : 4;

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
  if (t.players.includes(userId)) {
    return t;
  }

  // Cenário normal: torneio ainda não começou.
  if (t.status === 'waiting') {
    if (t.players.length >= t.maxPlayers) {
      throw new Error('Tournament full');
    }

    t.players.push(userId);
    t.updatedAt = now();
    return t;
  }

  // Permitir join tardio apenas para torneios 1v1 já iniciados que têm vaga aberta.
  if (t.status === 'running' && t.maxPlayers === 2) {
    if (t.players.length >= t.maxPlayers) {
      throw new Error('Tournament full');
    }

    const pendingWithSlot = t.matches.find(
      (m) =>
        m.status === 'pending' &&
        (m.player1Id === null || m.player1Id === undefined || m.player2Id === null || m.player2Id === undefined),
    );

    if (!pendingWithSlot) {
      throw new Error('No available match to join');
    }

    t.players.push(userId);
    if (!pendingWithSlot.player1Id) {
      pendingWithSlot.player1Id = userId;
    } else {
      pendingWithSlot.player2Id = userId;
    }
    t.updatedAt = now();
    return t;
  }

  throw new Error('Tournament already started');
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
 * Gera matches iniciais.
 * Suporta apenas torneios com 2 ou 4 jogadores.
 */
export function startTournament(tournamentId: string): Tournament {
  const t = tournaments.get(tournamentId);
  if (!t) {
    throw new Error('Tournament not found');
  }
  if (t.status !== 'waiting') {
    throw new Error('Tournament already started');
  }

  // Caminho 1v1: podemos iniciar com apenas um jogador (host entra na sala e espera oponente).
  if (t.maxPlayers === 2) {
    if (t.players.length < 1) {
      throw new Error('Not enough players (need at least 1)');
    }
    if (t.players.length > t.maxPlayers) {
      throw new Error('Tournament full');
    }

    const players = [...t.players];
    const matches: TournamentMatch[] = [];

    createMatch(
      t,
      {
        player1Id: players[0] ?? null,
        player2Id: players[1] ?? null,
        isFinal: true,
      },
      matches,
    );

    t.matches = matches;
    t.status = 'running';
    t.updatedAt = now();
    return t;
  }

  // Caminho 4 jogadores mantém a lógica original.
  if (t.players.length < 2) {
    throw new Error('Not enough players (need at least 2)');
  }
  if (t.players.length !== 2 && t.players.length !== 4) {
    throw new Error('This implementation supports tournaments with 2 or 4 players only');
  }

  const players = [...t.players];
  const matches: TournamentMatch[] = [];

  if (players.length === 2) {
    // final direta
    createMatch(
      t,
      {
        player1Id: players[0] ?? null,
        player2Id: players[1] ?? null,
        isFinal: true,
      },
      matches,
    );
  } else {
    // 4 jogadores: duas meias-finais + final
    const semi1 = createMatch(
      t,
      {
        player1Id: players[0] ?? null,
        player2Id: players[1] ?? null,
      },
      matches,
    );
    const semi2 = createMatch(
      t,
      {
        player1Id: players[2] ?? null,
        player2Id: players[3] ?? null,
      },
      matches,
    );

    // final (sem jogadores definidos ainda; vêm dos winners das semis)
    createMatch(
      t,
      {
        isFinal: true,
        sourceMatch1Id: semi1.id,
        sourceMatch2Id: semi2.id,
      },
      matches,
    );
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
 * Chamado pelo módulo de jogo quando um match termina.
 * Atualiza winner + avança a árvore (final).
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
    // procurar match dependente deste (ex.: final)
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

  if (finalMatch) {
    return { tournament, match, finalMatch };
  }
  return { tournament, match };
}
