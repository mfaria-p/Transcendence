// src/game.ts
/**
 * Implementação de Pong server-side (autoritativo) + integração opcional com torneios.
 *
 * Toda a lógica de física do jogo corre aqui no serviço ws. Os clientes:
 *  - enviam apenas inputs (up/down/none) via mensagens `game:input`
 *  - entram/saem de jogos com `game:join` e `game:leave`
 *  - recebem o estado completo do jogo em mensagens `game:state`
 */

import type WebSocket from 'ws';
import { forEachConnection } from './presence.js';
import { getMatchByRoomId, reportMatchResultByRoomId } from './tournament.js';

export interface GameMessage {
  type: string;
  [key: string]: unknown;
}

type Direction = 'up' | 'down' | 'none';
type Side = 'left' | 'right';

interface PlayerState {
  userId: string;
  side: Side;
  input: Direction;
}

interface GameState {
  width: number;
  height: number;
  paddleWidth: number;
  paddleHeight: number;
  ballSize: number;
  leftY: number;
  rightY: number;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
}

type GameStatus = 'waiting' | 'playing' | 'finished';

interface GameRoom {
  id: string;
  status: GameStatus;
  left?: PlayerState;
  right?: PlayerState;
  state: GameState;
  scores: { left: number; right: number };
  maxScore: number;
  loop?: NodeJS.Timeout;
  // tournament integration (opcional)
  isTournament: boolean;
  tournamentId?: string;
  matchId?: string;
}

const TICK_RATE = 60; // 60 updates por segundo
const TICK_MS = 1000 / TICK_RATE;
const PADDLE_SPEED = 400; // px/s
const BALL_SPEED = 550; // velocidade base da bola
const MAX_SCORE_DEFAULT = 5;

// rooms em memória e mapping user -> room
const rooms = new Map<string, GameRoom>();
const userToRoom = new Map<string, string>();

function normalizeId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function createInitialState(): GameState {
  const width = 800;
  const height = 450;
  const paddleHeight = 80;
  const paddleWidth = 12;
  const ballSize = 10;

  return {
    width,
    height,
    paddleWidth,
    paddleHeight,
    ballSize,
    leftY: height / 2 - paddleHeight / 2,
    rightY: height / 2 - paddleHeight / 2,
    ballX: width / 2,
    ballY: height / 2,
    ballVX: BALL_SPEED,
    ballVY: BALL_SPEED * 0.3,
  };
}

function resetBall(room: GameRoom, direction: Side): void {
  const s = room.state;
  s.ballX = s.width / 2;
  s.ballY = s.height / 2;

  const angle = (Math.random() * Math.PI) / 3 - Math.PI / 6; // [-30º, +30º]
  const speed = BALL_SPEED;
  const sign = direction === 'right' ? 1 : -1;
  s.ballVX = Math.cos(angle) * speed * sign;
  s.ballVY = Math.sin(angle) * speed;
}

function sendToUser(userId: string, payload: unknown): void {
  const json = JSON.stringify(payload);
  forEachConnection((uid, socket) => {
    if (uid === userId && socket.readyState === socket.OPEN) {
      socket.send(json);
    }
  });
}

function broadcastRoomState(room: GameRoom): void {
  const base = {
    type: 'game:state' as const,
    roomId: room.id,
    status: room.status,
    state: room.state,
    scores: room.scores,
    players: {
      left: room.left?.userId ?? null,
      right: room.right?.userId ?? null,
    },
    isTournament: room.isTournament,
    tournamentId: room.tournamentId ?? null,
    matchId: room.matchId ?? null,
  };

  if (room.left) {
    sendToUser(room.left.userId, { ...base, yourSide: 'left' as const });
  }
  if (room.right) {
    sendToUser(room.right.userId, { ...base, yourSide: 'right' as const });
  }
}

function startLoopIfReady(room: GameRoom): void {
  if (room.status === 'playing') return;
  if (!room.left || !room.right) return;

  room.status = 'playing';
  resetBall(room, Math.random() < 0.5 ? 'left' : 'right');

  room.loop = setInterval(() => {
    stepRoom(room);
  }, TICK_MS);
}

function stopLoop(room: GameRoom): void {
  if (room.loop) {
    clearInterval(room.loop);
    delete room.loop; // em vez de room.loop = undefined
  }
}

function stepRoom(room: GameRoom): void {
  if (room.status !== 'playing') return;

  const s = room.state;
  const dt = 1 / TICK_RATE;

  // Paddles
  if (room.left) {
    if (room.left.input === 'up') s.leftY -= PADDLE_SPEED * dt;
    else if (room.left.input === 'down') s.leftY += PADDLE_SPEED * dt;
  }
  if (room.right) {
    if (room.right.input === 'up') s.rightY -= PADDLE_SPEED * dt;
    else if (room.right.input === 'down') s.rightY += PADDLE_SPEED * dt;
  }

  // clamp paddles
  s.leftY = Math.max(0, Math.min(s.height - s.paddleHeight, s.leftY));
  s.rightY = Math.max(0, Math.min(s.height - s.paddleHeight, s.rightY));

  // Bola
  s.ballX += s.ballVX * dt;
  s.ballY += s.ballVY * dt;

  // topo/fundo
  if (s.ballY <= 0 && s.ballVY < 0) {
    s.ballY = 0;
    s.ballVY *= -1;
  } else if (s.ballY + s.ballSize >= s.height && s.ballVY > 0) {
    s.ballY = s.height - s.ballSize;
    s.ballVY *= -1;
  }

  // colisão com paddles
  checkPaddleCollision(room);

  // golo (fora do campo)
  if (s.ballX + s.ballSize < 0) {
    // passou lado esquerdo -> ponto para direita
    room.scores.right += 1;
    handleScore(room, 'right');
  } else if (s.ballX > s.width) {
    // passou lado direito -> ponto para esquerda
    room.scores.left += 1;
    handleScore(room, 'left');
  }

  broadcastRoomState(room);
}

function checkPaddleCollision(room: GameRoom): void {
  const s = room.state;

  // caixa da bola
  const ballLeft = s.ballX;
  const ballRight = s.ballX + s.ballSize;
  const ballTop = s.ballY;
  const ballBottom = s.ballY + s.ballSize;

  // paddle esquerda
  const paddleLeftX1 = 0;
  const paddleLeftX2 = s.paddleWidth;
  const paddleLeftY1 = s.leftY;
  const paddleLeftY2 = s.leftY + s.paddleHeight;

  if (
    ballLeft <= paddleLeftX2 &&
    ballRight >= paddleLeftX1 &&
    ballBottom >= paddleLeftY1 &&
    ballTop <= paddleLeftY2 &&
    s.ballVX < 0
  ) {
    s.ballX = s.paddleWidth;
    s.ballVX *= -1;
  }

  // paddle direita
  const paddleRightX2 = s.width;
  const paddleRightX1 = s.width - s.paddleWidth;
  const paddleRightY1 = s.rightY;
  const paddleRightY2 = s.rightY + s.paddleHeight;

  if (
    ballRight >= paddleRightX1 &&
    ballLeft <= paddleRightX2 &&
    ballBottom >= paddleRightY1 &&
    ballTop <= paddleRightY2 &&
    s.ballVX > 0
  ) {
    s.ballX = s.width - s.paddleWidth - s.ballSize;
    s.ballVX *= -1;
  }
}

function handleScore(room: GameRoom, scorer: Side): void {
  // reset bola para o lado de quem sofreu o golo
  resetBall(room, scorer === 'left' ? 'right' : 'left');

  if (room.scores.left >= room.maxScore || room.scores.right >= room.maxScore) {
    finishGame(room);
  }
}

function finishGame(room: GameRoom, forfeitLoserId?: string): void {
  if (room.status === 'finished') return;
  room.status = 'finished';
  stopLoop(room);

  let winnerSide: Side | null = null;
  if (forfeitLoserId && room.left && room.right) {
    if (room.left.userId === forfeitLoserId) winnerSide = 'right';
    else if (room.right.userId === forfeitLoserId) winnerSide = 'left';
  } else if (room.scores.left > room.scores.right) {
    winnerSide = 'left';
  } else if (room.scores.right > room.scores.left) {
    winnerSide = 'right';
  }

  const winnerUserId =
    winnerSide === 'left'
      ? room.left?.userId
      : winnerSide === 'right'
      ? room.right?.userId
      : undefined;

  // manda último snapshot de estado
  broadcastRoomState(room);

  if (winnerUserId) {
    const payload = {
      type: 'game:finished' as const,
      roomId: room.id,
      winnerUserId,
      scores: room.scores,
      isTournament: room.isTournament,
      tournamentId: room.tournamentId ?? null,
      matchId: room.matchId ?? null,
    };

    if (room.left) sendToUser(room.left.userId, payload);
    if (room.right) sendToUser(room.right.userId, payload);

    if (room.isTournament && room.tournamentId && room.matchId) {
      const update = reportMatchResultByRoomId(room.id, winnerUserId);
      if (update) {
        const { tournament } = update;
        // broadcast simples do estado do torneio para todos os jogadores ligados
        const tPayload = {
          type: 'tournament:update' as const,
          tournament,
        };
        const json = JSON.stringify(tPayload);
        forEachConnection((_uid, socket) => {
          if (socket.readyState === socket.OPEN) {
            socket.send(json);
          }
        });
      }
    }
  }

  // limpar mapping user -> room
  if (room.left) userToRoom.delete(room.left.userId);
  if (room.right) userToRoom.delete(room.right.userId);
  rooms.delete(room.id);
}

function ensureRoomForJoin(userId: string, msg: GameMessage): GameRoom | null {
  const uid = normalizeId(userId);
  if (!uid) return null;

  const requestedRoomId =
    typeof (msg as any).roomId === 'string'
      ? ((msg as any).roomId as string)
      : undefined;

  // Se já estiver numa sala, devolvemos essa
  const existingRoomId = userToRoom.get(uid);
  if (existingRoomId) {
    const r = rooms.get(existingRoomId);
    if (r) return r;
    userToRoom.delete(uid);
  }

  // Caso venha com roomId, tentamos ver se é match de torneio
  if (requestedRoomId) {
    const matchInfo = getMatchByRoomId(requestedRoomId);
    if (matchInfo) {
      const { tournament, match } = matchInfo;
      // check se o jogador pertence ao match
      const p1 = normalizeId(match.player1Id);
      const p2 = normalizeId(match.player2Id);
      if (p1 !== uid && p2 !== uid) {
        // não é jogador legítimo deste match
        return null;
      }

      let room = rooms.get(requestedRoomId);
      if (!room) {
        room = {
          id: requestedRoomId,
          status: 'waiting',
          state: createInitialState(),
          scores: { left: 0, right: 0 },
          maxScore: MAX_SCORE_DEFAULT,
          isTournament: true,
          tournamentId: tournament.id,
          matchId: match.id,
        };
        rooms.set(room.id, room);
      }
      return room;
    }

    // não é torneio -> sala ad-hoc
    let room = rooms.get(requestedRoomId);
    if (!room) {
      room = {
        id: requestedRoomId,
        status: 'waiting',
        state: createInitialState(),
        scores: { left: 0, right: 0 },
        maxScore: MAX_SCORE_DEFAULT,
        isTournament: false,
      };
      rooms.set(room.id, room);
    }
    return room;
  }

  // Sem roomId -> matchmaking muito simples
  // 1) tenta encontrar sala à espera de segundo jogador
  for (const room of rooms.values()) {
    if (
      !room.isTournament &&
      room.status === 'waiting' &&
      ((!room.left && room.right && room.right.userId !== userId) ||
        (!room.right && room.left && room.left.userId !== userId) ||
        (!room.left && !room.right))
    ) {
      return room;
    }
  }

  // 2) cria nova sala
  const randomId = `match_${Math.random().toString(36).slice(2, 10)}`;
  const room: GameRoom = {
    id: randomId,
    status: 'waiting',
    state: createInitialState(),
    scores: { left: 0, right: 0 },
    maxScore: MAX_SCORE_DEFAULT,
    isTournament: false,
  };
  rooms.set(room.id, room);
  return room;
}

function setPlayerInRoom(room: GameRoom, userId: string): Side | null {
  const uid = normalizeId(userId);
  if (!uid) return null;

  if (room.left && room.left.userId === uid) return 'left';
  if (room.right && room.right.userId === uid) return 'right';

  if (!room.left) {
    room.left = { userId: uid, side: 'left', input: 'none' };
    userToRoom.set(uid, room.id);
    return 'left';
  }
  if (!room.right && room.left.userId !== uid) {
    room.right = { userId: uid, side: 'right', input: 'none' };
    userToRoom.set(uid, room.id);
    return 'right';
  }
  return null;
}

function handleJoin(userId: string, socket: WebSocket, msg: GameMessage): void {
  const room = ensureRoomForJoin(userId, msg);
  if (!room) {
    if (socket.readyState === socket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'game:error',
          message: 'Unable to join game room',
        }),
      );
    }
    return;
  }

  const side = setPlayerInRoom(room, userId);
  if (!side) {
    if (socket.readyState === socket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'game:error',
          message: 'Room is full',
        }),
      );
    }
    return;
  }

  // enviar snapshot inicial
  broadcastRoomState(room);
  startLoopIfReady(room);
}

function handleInput(userId: string, msg: GameMessage): void {
  const uid = normalizeId(userId);
  if (!uid) return;
  const roomId = userToRoom.get(uid);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const direction = (msg as any).direction;
  let dir: Direction = 'none';
  if (direction === 'up' || direction === 'down' || direction === 'none') {
    dir = direction;
  }

  if (room.left && room.left.userId === uid) {
    room.left.input = dir;
  } else if (room.right && room.right.userId === uid) {
    room.right.input = dir;
  }
}

function handleLeave(userId: string): void {
  const uid = normalizeId(userId);
  if (!uid) return;
  const roomId = userToRoom.get(uid);
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) {
    userToRoom.delete(uid);
    return;
  }

  finishGame(room, uid);
}

export function handleDisconnect(userId: string): void {
  // Para já tratamos desconexão como abandono da partida
  handleLeave(userId);
}

// API pública usada em routes.ts
export function handleGameMessage(
  userId: string,
  socket: WebSocket,
  msg: GameMessage,
): void {
  switch (msg.type) {
    case 'game:join':
      handleJoin(userId, socket, msg);
      break;
    case 'game:input':
      handleInput(userId, msg);
      break;
    case 'game:leave':
      handleLeave(userId);
      break;
    default:
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'game:error',
            message: `Unknown game message type: ${msg.type}`,
          }),
        );
      }
      break;
  }
}
