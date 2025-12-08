// src/tournament.ts
/**
 * Gestão simples de torneios em memória (no serviço ws).
 *
 * Funcionalidades:
 *  - criar torneios 1v1 ou com 4 jogadores
 *  - gerar os matches iniciais (meias-finais + final para 4 players)
 *  - associar cada match a um roomId de jogo (Pong)
 *  - atualizar o torneio quando um match termina
 *
 * Não há persistência em BD: tudo vive na memória do processo.
 */

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
  // ligações para rounds seguintes (ex.: final recebe winners das meias-finais)
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
  const maxPlayers = input.maxPlayers && input.maxPlayers > 1 ? input.maxPlayers : 4;

  const t: Tournament = {
    id: genId('t'),
    name: input.name,
    ownerId: input.ownerId,
    maxPlayers,
    status: 'waiting',
    players: [input.ownerId],
    matches: [],
    createdAt: now(),
    updatedAt: now(),
  };

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

/**
 * Gera os matches iniciais.
 * Para simplificar, suportamos apenas torneios com 2 ou 4 jogadores.
 */
export function startTournament(tournamentId: string): Tournament {
  const t = tournaments.get(tournamentId);
  if (!t) {
    throw new Error('Tournament not found');
  }
  if (t.status !== 'waiting') {
    throw new Error('Tournament already started');
  }

  if (t.players.length < 2) {
    throw new Error('Not enough players (need at least 2)');
  }

  if (t.players.length !== 2 && t.players.length !== 4) {
    throw new Error('This simple implementation supports tournaments with 2 or 4 players only');
  }

  const players = [...t.players];
  const matches: TournamentMatch[] = [];

  // Helper para criar um match e registar o mapping roomId -> match
  const createMatch = (opts: {
    player1Id: string | null;
    player2Id: string | null;
    isFinal?: boolean;
    sourceMatch1Id?: string;
    sourceMatch2Id?: string;
  }): TournamentMatch => {
    const matchId = genId('m');
    const roomId = `room_${t.id}_${matchId}`;
    const match: TournamentMatch = {
      id: matchId,
      roomId,
      player1Id: opts.player1Id,
      player2Id: opts.player2Id,
      status: 'pending',
      winnerId: undefined,
      sourceMatch1Id: opts.sourceMatch1Id,
      sourceMatch2Id: opts.sourceMatch2Id,
      isFinal: opts.isFinal ?? false,
    };
    matches.push(match);
    roomToTournament.set(roomId, { tournamentId: t.id, matchId });
    return match;
  };

  if (players.length === 2) {
    // Torneio trivial: só uma final
    createMatch({
      player1Id: players[0],
      player2Id: players[1],
      isFinal: true,
    });
  } else if (players.length === 4) {
    // Duas meias-finais + uma final
    const semi1 = createMatch({
      player1Id: players[0],
      player2Id: players[1],
      isFinal: false,
    });
    const semi2 = createMatch({
      player1Id: players[2],
      player2Id: players[3],
      isFinal: false,
    });

    // Final ainda sem jogadores definidos (vêm dos winners das semis)
    createMatch({
      player1Id: null,
      player2Id: null,
      isFinal: true,
      sourceMatch1Id: semi1.id,
      sourceMatch2Id: semi2.id,
    });
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
 * Atualiza winner e, se for o caso, prepara o próximo round / final.
 */
export function reportMatchResultByRoomId(roomId: string, winnerId: string): {
  tournament: Tournament;
  match: TournamentMatch;
  finalMatch?: TournamentMatch;
} | undefined {
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
    // Procura um match que dependa deste (ex.: final)
    for (const m of tournament.matches) {
      if (m.sourceMatch1Id === match.id) {
        m.player1Id = winnerId;
        finalMatch = m;
      }
      if (m.sourceMatch2Id === match.id) {
        m.player2Id = winnerId;
        finalMatch = m;
      }
    }
  }

  return { tournament, match, finalMatch };
}
