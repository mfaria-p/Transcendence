// src/routes.ts

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
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
  startTournament,
  getTournament,
  listTournaments,
} from './tournament.js';

interface JwtPayload {
  sub: string;
}

type ClientMessage =
  | { type: 'ping'; ts?: number }
  | { type: 'subscribe_presence' }
  | { type: string; [key: string]: unknown }; // fallback, usado p/ game:*

type ServerMessage =
  | { type: 'hello'; userId: string; onlineUsers: string[] }
  | { type: 'presence'; event: 'online' | 'offline'; userId: string }
  | { type: 'pong'; ts?: number }
  | { type: 'error'; message: string };

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

  // Healthcheck simples
  app.get('/health', async () => {
    return { ok: true, service: 'ws' };
  });

  // Presença do próprio utilizador (precisa de JWT válido)
  app.get('/presence/me', { preHandler: [app.authenticate] }, async (req) => {
    const userId: string = req.jwtPayload!.id;
    return {
      success: true,
      userId,
      online: isOnline(userId),
    };
  });

  // Presença de outro utilizador
  app.get<{
    Params: { userId: string };
  }>('/presence/:userId', async (req) => {
    const { userId } = req.params;
    return {
      success: true,
      userId,
      online: isOnline(userId),
    };
  });

  // ---------- TOURNAMENT HTTP API ----------

  // Listar torneios (apenas para users autenticados)
  app.get('/tournaments', { preHandler: [app.authenticate] }, async () => {
    return {
      success: true,
      tournaments: listTournaments(),
    };
  });

  // Criar um novo torneio. O criador entra automaticamente como primeiro player.
  app.post<{
    Body: { name?: string; maxPlayers?: number };
  }>('/tournaments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;
    const { name, maxPlayers } = req.body ?? {};
    try {
      const tournament = createTournament({ ownerId: userId, name, maxPlayers });
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'createTournament failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  // Entrar num torneio existente
  app.post<{
    Params: { id: string };
  }>('/tournaments/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId: string = req.jwtPayload!.id;
    const { id } = req.params;
    try {
      const tournament = joinTournament(id, userId);
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'joinTournament failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  // Iniciar o torneio (gera matches / rooms)
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
      return { success: true, tournament };
    } catch (err) {
      req.log.error({ err }, 'startTournament failed');
      return reply.code(400).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  // Obter detalhes de um torneio
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

  app.get(
    '/ws',
    { websocket: true },
    async (connection: SocketStream, req: FastifyRequest) => {
      const socket: WebSocket = connection.socket;

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

      const userId = payload.sub;
      const { firstConnection } = addConnection(userId, socket);

      // 2) Mensagem inicial para o cliente
      safeSend(socket, {
        type: 'hello',
        userId,
        onlineUsers: getOnlineUsers(),
      });

      // Se for a primeira ligação deste user, broadcast do "online"
      if (firstConnection) {
        broadcastPresenceChange(userId, 'online');
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

        // Mensagens simples
        switch (msg.type) {
          case 'ping': {
            safeSend(socket, {
              type: 'pong',
              ts: (msg as any).ts ?? Date.now(),
            });
            return;
          }
          case 'subscribe_presence': {
            // Para já basta reenviar a lista atual
            safeSend(socket, {
              type: 'hello',
              userId,
              onlineUsers: getOnlineUsers(),
            });
            return;
          }
          default: {
            // Qualquer coisa que comece por "game:" vai para o módulo de jogo
            if (msg.type.startsWith('game:')) {
              handleGameMessage(userId, socket, msg as any);
              return;
            }

            safeSend(socket, {
              type: 'error',
              message: `Unknown message type: ${msg.type}`,
            });
          }
        }
      });

      socket.on('close', () => {
        const { lastConnection } = removeConnection(userId, socket);
        if (lastConnection) {
          broadcastPresenceChange(userId, 'offline');
        }
        // Notificar o módulo de jogo de que este user caiu (conta como abandono)
        handleDisconnect(userId);
      });

      socket.on('error', (err) => {
        app.log.error({ err }, 'WebSocket error');
      });
    },
  );
}
