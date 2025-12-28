import type WebSocket from 'ws';

import { forEachConnection } from './presence.js';
import { getMatchByRoomId, reportMatchResultByRoomId } from './tournament.js';

type Side = 'left' | 'right';
type InputDir = 'up' | 'down' | 'none';
type GameStatus = 'waiting' | 'playing' | 'finished';

interface PlayerSlot {
  userId: string;
  side: Side;
  input: InputDir;
}

interface GameState {
  width: number;
  height: number;

  paddleWidth: number;
  paddleHeight: number;

  leftPaddleY: number;
  rightPaddleY: number;

  ballRadius: number;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;

  // posições X fixas das raquetes (para colisões)
  leftPaddleX: number;
  rightPaddleX: number;
}

interface GameRoom {
  id: string;
  status: GameStatus;

  left: PlayerSlot | null;
  right: PlayerSlot | null;

  state: GameState;
  scores: { left: number; right: number };
  maxScore: number;

  loop: NodeJS.Timeout | null;

  // tournament integration
  isTournament: boolean;
  tournamentId?: string;
  matchId?: string;

  // lobby / remote play
  isPublic: boolean;
  name?: string;
  createdAt: number;
}

export interface LobbySummary {
  roomId: string;
  status: GameStatus;
  players: string[];
  createdAt: number;
  name?: string;
  ownerId?: string;
}

// ====== Config ======
const TICK_RATE = 60;
const DT = 1 / TICK_RATE;

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;

const PADDLE_WIDTH = 14;
const PADDLE_HEIGHT = 100;
const PADDLE_MARGIN_X = 20;
const PADDLE_SPEED = 420;

const BALL_RADIUS = 8;
const BALL_SPEED = 360;

const MAX_SCORE_DEFAULT = 5;

const WS_OPEN = 1;

// ====== Storage in-memory ======
const rooms = new Map<string, GameRoom>();
const userToRoom = new Map<string, string>();

function safeSend(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WS_OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendToUser(userId: string, payload: unknown): void {
  forEachConnection((uid, socket) => {
    if (uid === userId) safeSend(socket, payload);
  });
}

function broadcastAll(payload: unknown): void {
  forEachConnection((_uid, socket) => safeSend(socket, payload));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function createInitialState(): GameState {
  const leftX = PADDLE_MARGIN_X;
  const rightX = FIELD_WIDTH - PADDLE_MARGIN_X - PADDLE_WIDTH;

  const startPaddleY = (FIELD_HEIGHT - PADDLE_HEIGHT) / 2;

  return {
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,

    paddleWidth: PADDLE_WIDTH,
    paddleHeight: PADDLE_HEIGHT,

    leftPaddleX: leftX,
    rightPaddleX: rightX,

    leftPaddleY: startPaddleY,
    rightPaddleY: startPaddleY,

    ballRadius: BALL_RADIUS,
    ballX: FIELD_WIDTH / 2,
    ballY: FIELD_HEIGHT / 2,
    ballVX: 0,
    ballVY: 0,
  };
}

function resetBall(room: GameRoom, direction: 1 | -1): void {
  const s = room.state;
  s.ballX = s.width / 2;
  s.ballY = s.height / 2;

  // ângulo pequeno para não ficar sempre horizontal
  const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // [-0.3pi, 0.3pi]
  const vx = Math.cos(angle) * BALL_SPEED * direction;
  const vy = Math.sin(angle) * BALL_SPEED;

  s.ballVX = vx;
  s.ballVY = vy;
}

function roomPlayers(room: GameRoom): { left: string | null; right: string | null } {
  return {
    left: room.left ? room.left.userId : null,
    right: room.right ? room.right.userId : null,
  };
}

function sendRoomState(room: GameRoom): void {
  const base: any = {
    type: 'game:state',
    roomId: room.id,
    status: room.status,
    state: room.state,
    scores: room.scores,
    players: roomPlayers(room),
    isTournament: room.isTournament,
  };

  if (room.tournamentId !== undefined) base.tournamentId = room.tournamentId;
  if (room.matchId !== undefined) base.matchId = room.matchId;

  if (room.left) {
    sendToUser(room.left.userId, { ...base, yourSide: 'left' as const });
  }
  if (room.right && room.right.userId !== room.left?.userId) {
    sendToUser(room.right.userId, { ...base, yourSide: 'right' as const });
  }
}

function stopLoop(room: GameRoom): void {
  if (room.loop) {
    clearInterval(room.loop);
    room.loop = null;
  }
}

function startLoopIfReady(room: GameRoom): void {
  if (room.status !== 'waiting') return;
  if (!room.left || !room.right) return;

  room.status = 'playing';
  resetBall(room, Math.random() < 0.5 ? 1 : -1);

  room.loop = setInterval(() => stepRoom(room), 1000 / TICK_RATE);
  sendRoomState(room);
}

function finishGame(
  room: GameRoom,
  opts?: { forfeitLoserId?: string; forcedWinnerId?: string; reason?: 'score' | 'forfeit' },
): void {
  stopLoop(room);
  room.status = 'finished';

  const players = roomPlayers(room);

  let winnerId: string | null = null;
  let reason: 'score' | 'forfeit' = opts?.reason ?? 'score';

  if (opts?.forcedWinnerId) {
    winnerId = opts.forcedWinnerId;
    reason = opts.reason ?? 'forfeit';
  } else if (opts?.forfeitLoserId) {
    reason = 'forfeit';

    const loser = opts.forfeitLoserId;

    // Preferência: vencedor = o outro jogador conectado
    if (players.left && players.left !== loser) winnerId = players.left;
    if (players.right && players.right !== loser) winnerId = players.right;

    // Se não houver opponent conectado mas for torneio, tenta usar os players do match
    if (!winnerId && room.isTournament) {
      const info = getMatchByRoomId(room.id);
      if (info) {
        const p1 = info.match.player1Id;
        const p2 = info.match.player2Id;
        if (p1 && p1 !== loser) winnerId = p1;
        else if (p2 && p2 !== loser) winnerId = p2;
      }
    }
  } else {
    // por score
    if (room.scores.left > room.scores.right) winnerId = players.left;
    else if (room.scores.right > room.scores.left) winnerId = players.right;
  }

  const payload: any = {
    type: 'game:finished',
    roomId: room.id,
    winnerId,
    scores: room.scores,
    reason,
  };

  // avisa os dois lados se existirem
  if (players.left) sendToUser(players.left, payload);
  if (players.right && players.right !== players.left) sendToUser(players.right, payload);

  // se for torneio e houver winner, avança bracket
  if (room.isTournament && winnerId) {
    const res = reportMatchResultByRoomId(room.id, winnerId);
    if (res) {
      const update: any = {
        type: 'tournament:update',
        tournament: res.tournament,
        match: res.match,
      };
      if (res.finalMatch !== undefined) update.finalMatch = res.finalMatch;
      broadcastAll(update);
    }
  }

  // cleanup
  if (players.left) userToRoom.delete(players.left);
  if (players.right) userToRoom.delete(players.right);
  rooms.delete(room.id);
}

function stepRoom(room: GameRoom): void {
  if (room.status !== 'playing') return;

  const s = room.state;

  // --- paddles ---
  if (room.left) {
    if (room.left.input === 'up') s.leftPaddleY -= PADDLE_SPEED * DT;
    else if (room.left.input === 'down') s.leftPaddleY += PADDLE_SPEED * DT;
    s.leftPaddleY = clamp(s.leftPaddleY, 0, s.height - s.paddleHeight);
  }

  if (room.right) {
    if (room.right.input === 'up') s.rightPaddleY -= PADDLE_SPEED * DT;
    else if (room.right.input === 'down') s.rightPaddleY += PADDLE_SPEED * DT;
    s.rightPaddleY = clamp(s.rightPaddleY, 0, s.height - s.paddleHeight);
  }

  // --- ball ---
  s.ballX += s.ballVX * DT;
  s.ballY += s.ballVY * DT;

  // top/bottom
  if (s.ballY - s.ballRadius <= 0) {
    s.ballY = s.ballRadius;
    s.ballVY = -s.ballVY;
  } else if (s.ballY + s.ballRadius >= s.height) {
    s.ballY = s.height - s.ballRadius;
    s.ballVY = -s.ballVY;
  }

  // paddles collision
  const inLeftPaddleY =
    s.ballY >= s.leftPaddleY && s.ballY <= s.leftPaddleY + s.paddleHeight;
  const inRightPaddleY =
    s.ballY >= s.rightPaddleY && s.ballY <= s.rightPaddleY + s.paddleHeight;

  // left paddle
  if (
    s.ballVX < 0 &&
    s.ballX - s.ballRadius <= s.leftPaddleX + s.paddleWidth &&
    s.ballX - s.ballRadius >= s.leftPaddleX &&
    inLeftPaddleY
  ) {
    s.ballX = s.leftPaddleX + s.paddleWidth + s.ballRadius;
    s.ballVX = Math.abs(s.ballVX);

    // “spin” simples baseado no ponto de impacto
    const hit =
      (s.ballY - (s.leftPaddleY + s.paddleHeight / 2)) / (s.paddleHeight / 2);
    s.ballVY = clamp(hit, -1, 1) * BALL_SPEED * 0.9;
  }

  // right paddle
  if (
    s.ballVX > 0 &&
    s.ballX + s.ballRadius >= s.rightPaddleX &&
    s.ballX + s.ballRadius <= s.rightPaddleX + s.paddleWidth &&
    inRightPaddleY
  ) {
    s.ballX = s.rightPaddleX - s.ballRadius;
    s.ballVX = -Math.abs(s.ballVX);

    const hit =
      (s.ballY - (s.rightPaddleY + s.paddleHeight / 2)) / (s.paddleHeight / 2);
    s.ballVY = clamp(hit, -1, 1) * BALL_SPEED * 0.9;
  }

  // scoring
  if (s.ballX + s.ballRadius < 0) {
    // direita marcou
    room.scores.right += 1;

    if (room.scores.right >= room.maxScore) {
      finishGame(room, { reason: 'score' });
      return;
    }
    resetBall(room, -1);
  } else if (s.ballX - s.ballRadius > s.width) {
    // esquerda marcou
    room.scores.left += 1;

    if (room.scores.left >= room.maxScore) {
      finishGame(room, { reason: 'score' });
      return;
    }
    resetBall(room, 1);
  }

  sendRoomState(room);
}

function getRoomForUser(userId: string): GameRoom | null {
  const rid = userToRoom.get(userId);
  if (!rid) return null;
  const room = rooms.get(rid);
  if (!room) {
    userToRoom.delete(userId);
    return null;
  }
  return room;
}

function ensureRoomForJoin(userId: string, requestedRoomId?: string): { room: GameRoom; side?: Side } {
  // 1) roomId especificado => pode ser torneio / lobby / private room
  if (requestedRoomId) {
    const matchInfo = getMatchByRoomId(requestedRoomId);

    // 1.a) É match de torneio
    if (matchInfo) {
      const { tournament, match } = matchInfo;

      const isP1 = match.player1Id === userId;
      const isP2 = match.player2Id === userId;

      if (!isP1 && !isP2) {
        throw new Error('You are not a player of this match (or match not ready yet).');
      }

      let room = rooms.get(requestedRoomId);
      if (!room) {
        room = {
          id: requestedRoomId,
          status: 'waiting',
          left: null,
          right: null,
          state: createInitialState(),
          scores: { left: 0, right: 0 },
          maxScore: MAX_SCORE_DEFAULT,
          loop: null,
          isTournament: true,
          tournamentId: tournament.id,
          matchId: match.id,
          isPublic: false,
          createdAt: Date.now(),
        };
        rooms.set(room.id, room);
      }

      return { room, side: isP1 ? 'left' : 'right' };
    }

    // 1.b) Não é torneio => lobby_* ou sala privada
    let room = rooms.get(requestedRoomId);
    if (!room) {
      const isLobby = requestedRoomId.startsWith('lobby_');

      room = {
        id: requestedRoomId,
        status: 'waiting',
        left: null,
        right: null,
        state: createInitialState(),
        scores: { left: 0, right: 0 },
        maxScore: MAX_SCORE_DEFAULT,
        loop: null,
        isTournament: false,
        isPublic: isLobby,
        createdAt: Date.now(),
      };
      rooms.set(room.id, room);
    }

    return { room };
  }

  // 2) quick matchmaking: procura sala não pública e não torneio com slot livre
  for (const room of rooms.values()) {
    if (room.isTournament) continue;
    if (room.isPublic) continue;
    if (room.status !== 'waiting') continue;

    const leftOk = !room.left || room.left.userId === userId;
    const rightOk = !room.right || room.right.userId === userId;

    if (!leftOk || !rightOk) continue;

    if (!room.left) return { room, side: 'left' };
    if (!room.right) return { room, side: 'right' };
  }

  // 3) cria nova sala de quick play
  const rid = `match_${Math.random().toString(36).slice(2, 10)}`;
  const room: GameRoom = {
    id: rid,
    status: 'waiting',
    left: null,
    right: null,
    state: createInitialState(),
    scores: { left: 0, right: 0 },
    maxScore: MAX_SCORE_DEFAULT,
    loop: null,
    isTournament: false,
    isPublic: false,
    createdAt: Date.now(),
  };
  rooms.set(room.id, room);
  return { room, side: 'left' };
}

function setPlayer(room: GameRoom, userId: string, side?: Side): void {
  // se já está na room, mantém
  if (room.left?.userId === userId || room.right?.userId === userId) {
    userToRoom.set(userId, room.id);
    return;
  }

  // se side foi pedido (torneio), respeita
  if (side === 'left') {
    if (room.left && room.left.userId !== userId) throw new Error('Left slot already taken');
    room.left = { userId, side: 'left', input: 'none' };
    userToRoom.set(userId, room.id);
    return;
  }
  if (side === 'right') {
    if (room.right && room.right.userId !== userId) throw new Error('Right slot already taken');
    room.right = { userId, side: 'right', input: 'none' };
    userToRoom.set(userId, room.id);
    return;
  }

  // sem side: ocupa o primeiro slot livre
  if (!room.left) {
    room.left = { userId, side: 'left', input: 'none' };
    userToRoom.set(userId, room.id);
    return;
  }
  if (!room.right) {
    room.right = { userId, side: 'right', input: 'none' };
    userToRoom.set(userId, room.id);
    return;
  }

  throw new Error('Room is full');
}

function removePlayer(room: GameRoom, userId: string): void {
  if (room.left?.userId === userId) room.left = null;
  if (room.right?.userId === userId) room.right = null;
  userToRoom.delete(userId);

  // se ficou só right, move para left (melhor UX em lobbies)
  if (!room.left && room.right) {
    room.left = { ...room.right, side: 'left' };
    room.right = null;
  }
}

function handleLeave(userId: string): void {
  const room = getRoomForUser(userId);
  if (!room) return;

  // se já estava a jogar => forfeit e fecha
  if (room.status === 'playing') {
    finishGame(room, { forfeitLoserId: userId, reason: 'forfeit' });
    return;
  }

  // se ainda estava à espera:
  // - em torneio, tratamos como forfeit também (se já houver opponent definido)
  if (room.isTournament) {
    // tenta determinar winner pelo match
    const info = getMatchByRoomId(room.id);
    const p1 = info?.match.player1Id ?? null;
    const p2 = info?.match.player2Id ?? null;

    // se existe opponent definido, damos win a esse
    const forcedWinner =
      p1 && p1 !== userId ? p1 : p2 && p2 !== userId ? p2 : null;

    if (forcedWinner) {
      finishGame(room, { forcedWinnerId: forcedWinner, reason: 'forfeit' });
      return;
    }
  }

  // caso normal: remove o jogador; se a sala ficar vazia, apaga
  removePlayer(room, userId);
  sendRoomState(room);

  if (!room.left && !room.right) {
    rooms.delete(room.id);
  }
}

export function handleDisconnect(userId: string): void {
  handleLeave(userId);
}

export function handleGameMessage(userId: string, socket: WebSocket, msg: any): void {
  try {
    if (!msg || typeof msg.type !== 'string') {
      safeSend(socket, { type: 'game:error', message: 'Missing message type' });
      return;
    }

    switch (msg.type) {
      case 'game:join': {
        const requestedRoomId =
          typeof msg.roomId === 'string' ? (msg.roomId as string) : undefined;

        // se já estava noutra sala, sai (forfeit)
        const current = getRoomForUser(userId);
        if (current && current.id !== requestedRoomId) {
          handleLeave(userId);
        }

        const { room, side } = ensureRoomForJoin(userId, requestedRoomId);
        setPlayer(room, userId, side);

        sendRoomState(room);
        startLoopIfReady(room);
        return;
      }

      case 'game:input': {
        const dirRaw = msg.direction;
        const dir: InputDir = dirRaw === 'up' || dirRaw === 'down' || dirRaw === 'none' ? dirRaw : 'none';

        const room = getRoomForUser(userId);
        if (!room) {
          safeSend(socket, { type: 'game:error', message: 'Not in a room' });
          return;
        }
        if (room.left?.userId === userId) room.left.input = dir;
        else if (room.right?.userId === userId) room.right.input = dir;
        else safeSend(socket, { type: 'game:error', message: 'Not a player of this room' });

        return;
      }

      case 'game:leave': {
        handleLeave(userId);
        return;
      }

      default:
        safeSend(socket, { type: 'game:error', message: `Unknown game msg: ${msg.type}` });
    }
  } catch (err) {
    safeSend(socket, {
      type: 'game:error',
      message: (err as Error).message ?? 'Unknown error',
    });
  }
}

// ===== Lobby API (para o routes.ts) =====

export function listLobbies(): LobbySummary[] {
  const out: LobbySummary[] = [];

  for (const room of rooms.values()) {
    if (room.isTournament) continue;
    if (!room.isPublic) continue;
    if (room.status !== 'waiting') continue;

    const players: string[] = [];
    if (room.left) players.push(room.left.userId);
    if (room.right && room.right.userId !== room.left?.userId) players.push(room.right.userId);

    const summary: LobbySummary = {
      roomId: room.id,
      status: room.status,
      players,
      createdAt: room.createdAt,
    };

    if (room.name !== undefined) summary.name = room.name;
    if (room.left?.userId !== undefined) summary.ownerId = room.left.userId;

    out.push(summary);
  }

  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}

export function createLobbyForUser(userId: string, name?: string): LobbySummary {
  // se já estava num jogo/sala, sai (forfeit se estiver a jogar)
  handleLeave(userId);

  const lobbyId = `lobby_${Math.random().toString(36).slice(2, 10)}`;

  const room: GameRoom = {
    id: lobbyId,
    status: 'waiting',
    left: { userId, side: 'left', input: 'none' },
    right: null,
    state: createInitialState(),
    scores: { left: 0, right: 0 },
    maxScore: MAX_SCORE_DEFAULT,
    loop: null,
    isTournament: false,
    isPublic: true,
    createdAt: Date.now(),
  };

  if (name !== undefined) {
    room.name = name;
  }

  rooms.set(room.id, room);
  userToRoom.set(userId, room.id);

  const summary: LobbySummary = {
    roomId: room.id,
    status: room.status,
    players: [userId],
    createdAt: room.createdAt,
    ownerId: userId,
  };

  if (room.name !== undefined) summary.name = room.name;

  return summary;
}
