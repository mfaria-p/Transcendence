import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import replyFrom from '@fastify/reply-from';
import jwtPlugin from '@pkg/lib-auth';
import * as dotenv from 'dotenv';

dotenv.config();

const {
  GATEWAY_PORT = '3000',
  AUTH_URL = 'http://auth:3001',
  USERS_URL = 'http://user:3002',
  REALTIME_URL = 'http://ws:3003',
} = process.env;

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Segurança base no gateway
  await app.register(cors, {
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // JWT plugin (@pkg/lib-auth) -> app.jwt + app.authenticate
  await app.register(jwtPlugin);

  // reply-from para fazer proxy
  await app.register(replyFrom);

  // Healthcheck simples
  app.get('/api/health', async () => ({ ok: true }));

  // ---------- AUTH (rotas abertas) ----------
  app.all('/api/auth/*', async (req, reply) => {
    const path = req.url.replace(/^\/api\/auth/, '/auth');
    return reply.from(`${AUTH_URL}${path}`);
  });

  // ---------- USER (rotas protegidas por JWT) ----------
  app.all('/api/user/*', async (req: FastifyRequest, reply: FastifyReply) => {
    // try {
    //   // proteger tudo o que é /api/user/**
    //   await (app as any).authenticate(req, reply);
    // } catch {
    //   return reply.code(401).send({ error: 'Unauthorized' });
    // }

    const path = req.url.replace(/^\/api\/user/, '/user');
    return reply.from(`${USERS_URL}${path}`);
  });

  // ---------- REALTIME (ws-service HTTP API, também protegido) ----------
  app.all(
    '/api/realtime/*',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await (app as any).authenticate(req, reply);
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const path = req.url.replace(/^\/api\/realtime/, '');
      // aqui não precisamos de mexer em headers; reply-from reencaminha os originais
      return reply.from(`${REALTIME_URL}${path}`);
    },
  );

  return app;
}

const start = async () => {
  const app = await build();
  const port = Number(GATEWAY_PORT) || 3000;

  try {
    await app.listen({ host: '0.0.0.0', port });
    app.log.info(`gateway listening on :${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
