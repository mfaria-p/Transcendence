import type { FastifyInstance, FastifyRequest } from 'fastify';
import type WebSocket from 'ws';

import {
  addConnection,
  removeConnection,
  getOnlineUsers,
  isOnline,
  forEachConnection,
} from './presence.js';

import {
  handleGameMessage,
  handleDisconnect,
  listLobbies,
  createLobbyForUser,
} from './game.js';
import type { LobbySummary } from './game.js';

import {
  createTournament,
  joinTournament,
  startTournament,
  getTournament,
  listTournaments,
} from './tournament.js';

type JwtPayload = {
  sub?: string;
  id?: string;
};

type ClientMessage =
  | { type: 'ping'; ts?: number }
  | { type: 'subscribe_presence' }
  | { type: 'lobby:list' }
  | { type: 'lobby:create'; name?: string }
  | { type: string; [key: string]: unknown };

type ServerMessage =
  | { type: 'hello'; userId: string; onlineUsers: string[] }
  | { type: 'presence'; event: 'online' | 'offline'; userId: string }
  | { type: 'pong'; ts?: number }
  | { type: 'error'; message: string }
  | { type: 'lobby:list'; lobbies: LobbySummary[] }
  | { type: 'lobby:created'; lobby: LobbySummary; lobbies: LobbySummary[] }
  | { type: 'lobby:update'; lobbies: LobbySummary[] };

const WS_OPEN = 1;

function safeSend(socket: WebSocket, msg: unknown): void {
  if (socket.readyState === WS_OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function broadcastToAll(payload: unknown): void {
  forEachConnection((_uid, socket) => safeSend(socket, payload));
}

function broadcastPresenceChange(userId: string, event: 'online' | 'offline'): void {
  const message: ServerMessage = { type: 'presence', event, userId };
  broadcastToAll(message);
}

function broadcastLobbyUpdate(): void {
  const lobbies = listLobbies();
  const payload: ServerMessage = { type: 'lobby:update', lobbies };
  broadcastToAll(payload);
}

function extractToken(req: FastifyRequest): string | null {
  const q = (req.query ?? {}) as { token?: string; access_token?: string };
  if (q.token) return q.token;
  if (q.access_token) return q.access_token;

  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return null;
}

function getReqUserId(req: FastifyRequest): string {
  // robusto para jwtPayload.id ou jwtPayload.sub
  const p = (req as any).jwtPayload as { id?: string; sub?: string } | undefined;
  const id = p?.id ?? p?.sub;
  if (!id || typeof id !== 'string') throw new Error('Missing user id');
  return id;
}

export default async function routes(app: FastifyInstance): Promise<void> {
  // ---------- HTTP ROUTES ----------
  app.get('/health', async () => {
    return { ok: true, service: 'ws' };
  });

  app.get('/presence/me', { preHandler: [app.authenticate] }, async (req) => {
    const userId = getReqUserId(req);
    return {
      success: true,
      userId,
      online: isOnline(userId),
    };
  });

  app.get<{
    Params: { userId: string };
  }>('/presence/:userId', async (req) => {
    const { userId } = req.params;
    return { success: true, userId, online: isOnline(userId) };
  });

  // ---------- TOURNAMENT HTTP API ----------
  app.get('/tournaments', { preHandler: [app.authenticate] }, async () => {
    return { success: true, tournaments: listTournaments() };
  });

  app.post<{
    Body: { name?: string; maxPlayers?: number };
  }>('/tournaments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = getReqUserId(req);

    try {
      const { name, maxPlayers } = req.body ?? {};

      const input: { ownerId: string; name?: string; maxPlayers?: number } = {
        ownerId: userId,
      };

      if (typeof name === 'string') input.name = name;
      if (typeof maxPlayers === 'number') input.maxPlayers = maxPlayers;

      const tournament = createTournament(input);
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'createTournament failed');
      return reply.code(400).send({ success: false, error: (err as Error).message });
    }
  });

  app.post<{
    Params: { id: string };
  }>('/tournaments/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = getReqUserId(req);
    const { id } = req.params;

    try {
      const tournament = joinTournament(id, userId);
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'joinTournament failed');
      return reply.code(400).send({ success: false, error: (err as Error).message });
    }
  });

  app.post<{
    Params: { id: string };
  }>('/tournaments/:id/start', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = getReqUserId(req);
    const { id } = req.params;

    const t = getTournament(id);
    if (!t) return reply.code(404).send({ success: false, error: 'Tournament not found' });
    if (t.ownerId !== userId) {
      return reply.code(403).send({ success: false, error: 'Only owner can start the tournament' });
    }

    try {
      const tournament = startTournament(id);
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'startTournament failed');
      return reply.code(400).send({ success: false, error: (err as Error).message });
    }
  });

  app.get<{
    Params: { id: string };
  }>('/tournaments/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params;
    const tournament = getTournament(id);
    if (!tournament) {
      return reply.code(404).send({ success: false, error: 'Tournament not found' });
    }
    return { success: true, tournament };
  });

  // ---------- WEBSOCKET ROUTE ----------
  app.get('/ws', { websocket: true }, async (connection, req: FastifyRequest) => {
    const socket = (connection as any).socket as WebSocket;

    // 1) Autenticação JWT
    const rawToken = extractToken(req);
    if (!rawToken) {
      socket.close(4001, 'Missing token');
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await app.jwt.verify<JwtPayload>(rawToken);
    } catch {
      socket.close(4002, 'Invalid token');
      return;
    }

    const userId = payload.sub ?? payload.id;
    if (!userId) {
      socket.close(4002, 'Invalid token payload');
      return;
    }

    const { firstConnection } = addConnection(userId, socket);

    // 2) Hello inicial
    safeSend(socket, { type: 'hello', userId, onlineUsers: getOnlineUsers() } satisfies ServerMessage);

    if (firstConnection) {
      broadcastPresenceChange(userId, 'online');
    }

    // 3) handlers
    socket.on('message', (buf: Buffer) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(buf.toString('utf8'));
      } catch {
        safeSend(socket, { type: 'error', message: 'Invalid JSON' } satisfies ServerMessage);
        return;
      }

      if (!msg || typeof msg.type !== 'string') {
        safeSend(socket, { type: 'error', message: 'Missing message type' } satisfies ServerMessage);
        return;
      }

      switch (msg.type) {
        case 'ping':
          safeSend(socket, { type: 'pong', ts: (msg as any).ts ?? Date.now() } satisfies ServerMessage);
          return;

        case 'subscribe_presence':
          safeSend(socket, { type: 'hello', userId, onlineUsers: getOnlineUsers() } satisfies ServerMessage);
          return;

        case 'lobby:list': {
          const lobbies = listLobbies();
          safeSend(socket, { type: 'lobby:list', lobbies } satisfies ServerMessage);
          return;
        }

        case 'lobby:create': {
          const name = typeof (msg as any).name === 'string' ? ((msg as any).name as string) : undefined;

          const lobby = createLobbyForUser(userId, name);
          const lobbies = listLobbies();

          safeSend(socket, { type: 'lobby:created', lobby, lobbies } satisfies ServerMessage);

          // broadcast update para todos
          broadcastLobbyUpdate();
          return;
        }

        default:
          if (msg.type.startsWith('game:')) {
            handleGameMessage(userId, socket, msg as any);

            // Só broadcast de lobby quando JOIN/LEAVE (para não spammar em inputs)
            if (msg.type === 'game:join' || msg.type === 'game:leave') {
              broadcastLobbyUpdate();
            }
            return;
          }

          safeSend(socket, { type: 'error', message: `Unknown message type: ${msg.type}` } satisfies ServerMessage);
      }
    });

    socket.on('close', () => {
      const { lastConnection } = removeConnection(userId, socket);

      // Só quando o utilizador fica mesmo offline
      if (lastConnection) {
        broadcastPresenceChange(userId, 'offline');
        handleDisconnect(userId);
      }
    });

    socket.on('error', (err) => {
      app.log.error({ err }, 'WebSocket error');
    });
  });
}
