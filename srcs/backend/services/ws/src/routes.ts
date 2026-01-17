import type { FastifyInstance, FastifyRequest } from 'fastify';
import type WebSocket from 'ws';

import {
  addConnection,
  removeConnection,
  getOnlineUsers,
  isOnline,
  forEachConnection,
} from './presence.js';
import { handleGameMessage, handleDisconnect } from './game.js';
import {
  createTournament,
  joinTournament,
  joinTournamentWithCode,
  startTournament,
  getTournament,
  listTournaments,
  findTournamentByJoinCode,
} from './tournament.js';
import { emitTournamentUpdate, emitTournamentsChanged, emitUserEvent } from './events.js';

interface JwtPayload {
  sub: string;
}

type ClientMessage =
  | { type: 'ping'; ts?: number }
  | { type: 'subscribe_presence' }
  | { type: string; [key: string]: unknown };

type ServerMessage =
  | { type: 'hello'; userId: string; onlineUsers: string[] }
  | { type: 'presence'; event: 'online' | 'offline'; userId: string }
  | { type: 'pong'; ts?: number }
  | { type: 'tournaments:changed'; ts: number }
  | { type: 'tournament:update'; tournament: unknown; ts: number }
  | { type: 'user:event'; event: string; data?: unknown; ts: number }
  | { type: 'error'; message: string };

function normalizeId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function safeSend(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function broadcastPresenceChange(
  userId: string,
  event: 'online' | 'offline',
): void {
  const message: ServerMessage = {
    type: 'presence',
    event,
    userId,
  };

  forEachConnection((_uid, socket) => {
    safeSend(socket, message);
  });
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

export default async function routes(app: FastifyInstance): Promise<void> {
  // ---------- HTTP ROUTES ----------

  app.get('/health', async () => {
    return { ok: true, service: 'ws' };
  });

  // ---------- INTERNAL (SERVICE-TO-SERVICE) API ----------

  /**
   * Service-to-service endpoint used by other backend services (e.g. user-service)
   * to push real-time notifications to connected users.
   *
   * Not exposed through the gateway/nginx (only available inside docker network),
   * and protected with a shared token.
   */
  app.post<{
    Body: { userIds?: unknown; event?: unknown; data?: unknown };
  }>('/internal/user-event', async (req, reply) => {
    const expected = process.env.INTERNAL_WS_TOKEN;
    const provided = req.headers['x-internal-token'];
    if (!expected || provided !== expected) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const body = req.body ?? {};
    const userIdsRaw = (body as any).userIds;
    const eventRaw = (body as any).event;
    const data = (body as any).data;

    if (!Array.isArray(userIdsRaw) || typeof eventRaw !== 'string' || eventRaw.trim().length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Expected body { userIds: string[], event: string, data?: any }',
      });
    }

    const userIds = userIdsRaw.map((v) => String(v)).filter((v) => v.trim().length > 0);
    const event = eventRaw.trim();

    emitUserEvent(userIds, event, data);
    return { success: true };
  });

  app.get('/presence/me', { preHandler: [app.authenticate] }, async (req) => {
    const userId = normalizeId(req.jwtPayload!.id);
    const online = userId ? isOnline(userId) : false;
    return {
      success: true,
      userId,
      online,
    };
  });

  app.get<{
    Params: { userId: string };
  }>('/presence/:userId', async (req) => {
    const userId = normalizeId(req.params.userId);
    const online = userId ? isOnline(userId) : false;
    return {
      success: true,
      userId,
      online,
    };
  });

  // ---------- TOURNAMENT HTTP API ----------

  app.get('/tournaments', { preHandler: [app.authenticate] }, async (req) => {
    const userId: string = req.jwtPayload!.id;
    return {
      success: true,
      tournaments: listTournaments(userId),
    };
  });

  app.post<{
    Body: { name?: string; maxPlayers?: number; isPrivate?: boolean };
  }>('/tournaments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;

    try {
      const { name, maxPlayers, isPrivate } = req.body ?? {};

      const input: { ownerId: string; name?: string; maxPlayers?: number; isPrivate?: boolean } = {
        ownerId: userId,
      };

      if (typeof name === 'string') {
        input.name = name;
      }
      if (typeof maxPlayers === 'number') {
        input.maxPlayers = maxPlayers;
      }
      if (typeof isPrivate === 'boolean') {
        input.isPrivate = isPrivate;
      }

      const tournament = createTournament(input);
      // realtime notifications
      emitTournamentUpdate(tournament);
      emitTournamentsChanged();
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'createTournament failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  app.post<{
    Body: { code: string };
  }>('/tournaments/join-by-code', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;
    const { code } = req.body ?? {};

    if (typeof code !== 'string' || code.trim().length === 0) {
      return reply.code(400).send({ success: false, error: 'Join code is required' });
    }

    const t = findTournamentByJoinCode(code);
    if (!t) {
      return reply.code(404).send({ success: false, error: 'No tournament found for this code' });
    }

    if (t.status === 'finished') {
      return reply.code(400).send({ success: false, error: 'Tournament already finished' });
    }

    try {
      const tournament = joinTournamentWithCode(t.id, userId, code);
      emitTournamentUpdate(tournament);
      emitTournamentsChanged();
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'joinTournamentByCode failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  app.post<{
    Params: { id: string };
    Body: { joinCode?: string };
  }>('/tournaments/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;
    const { id } = req.params;
    const { joinCode } = req.body ?? {};

    try {
      const tournament = joinTournament(id, userId, joinCode);
      emitTournamentUpdate(tournament);
      emitTournamentsChanged();
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'joinTournament failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  app.post<{
    Params: { id: string };
  }>('/tournaments/:id/start', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;
    const { id } = req.params;

    const t = getTournament(id);
    if (!t) {
      return reply.code(404).send({ success: false, error: 'Tournament not found' });
    }
    if (t.ownerId !== userId) {
      return reply.code(403).send({ success: false, error: 'Only owner can start the tournament' });
    }

    try {
      const tournament = startTournament(id);
      emitTournamentUpdate(tournament);
      emitTournamentsChanged();
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'startTournament failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  app.get<{
    Params: { id: string };
  }>('/tournaments/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;
    const { id } = req.params;
    const tournament = getTournament(id);
    if (!tournament) {
      return reply.code(404).send({ success: false, error: 'Tournament not found' });
    }
    const canView =
      tournament.visibility === 'public' ||
      tournament.ownerId === userId ||
      tournament.players.includes(userId);

    if (!canView) {
      return reply.code(403).send({ success: false, error: 'This tournament is private' });
    }
    return { success: true, tournament };
  });

  // ---------- WEBSOCKET ROUTE ----------

  app.get(
    '/ws',
    { websocket: true },
    async (connection: unknown, req: FastifyRequest) => {
      const maybeStream = connection as { socket?: WebSocket };
      const socket: WebSocket = maybeStream.socket ?? (connection as WebSocket);

      // 1) Autenticação por JWT
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

      const userId = normalizeId(payload.sub);
      if (!userId) {
        safeSend(socket, { type: 'error', message: 'Invalid user id in token' });
        return socket.close();
      }
      const uid = userId;
      const { firstConnection } = addConnection(uid, socket);

      // 2) Mensagem inicial
      safeSend(socket, {
        type: 'hello',
        userId: uid,
        onlineUsers: getOnlineUsers(),
      });

      if (firstConnection) {
        broadcastPresenceChange(uid, 'online');
      }

      // 3) Handlers
      socket.on('message', (buf: Buffer) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(buf.toString('utf8'));
        } catch {
          safeSend(socket, {
            type: 'error',
            message: 'Invalid JSON',
          });
          return;
        }

        if (!msg || typeof msg.type !== 'string') {
          safeSend(socket, {
            type: 'error',
            message: 'Missing message type',
          });
          return;
        }

        switch (msg.type) {
          case 'ping':
            safeSend(socket, {
              type: 'pong',
              ts: (msg as any).ts ?? Date.now(),
            });
            return;

          case 'subscribe_presence':
            safeSend(socket, {
              type: 'hello',
              userId: uid,
              onlineUsers: getOnlineUsers(),
            });
            return;

          default:
            if (msg.type.startsWith('game:')) {
              handleGameMessage(uid, socket, msg as any);
              return;
            }
            safeSend(socket, {
              type: 'error',
              message: `Unknown message type: ${msg.type}`,
            });
        }
      });

      socket.on('close', () => {
        const { lastConnection } = removeConnection(uid, socket);
        if (lastConnection) {
          broadcastPresenceChange(uid, 'offline');
        }
        handleDisconnect(uid);
      });

      socket.on('error', (err) => {
        app.log.error({ err }, 'WebSocket error');
      });
    },
  );
}
