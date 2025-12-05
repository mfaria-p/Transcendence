import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import replyFrom from '@fastify/reply-from';
import jwtPlugin from '@pkg/lib-auth';
import * as dotenv from 'dotenv';
dotenv.config();

const {
    GATEWAY_PORT = '3000',
    AUTH_URL = 'http://auth:3001',
    USERS_URL = 'http://users:3002',
    REALTIME_URL = 'http://ws:3003'
} = process.env;

async function build(): Promise<FastifyInstance> {
    const app = Fastify({ logger: true });

    // Segurança base no gateway
    await app.register(cors, {
        origin: true,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(jwtPlugin); // expõe app.jwt e app.authenticate

    // util: forward cookies e headers importantes
    const proxyOpts = {
        rewriteRequestHeaders: (origReq: FastifyRequest, headers: Record<string, string>) => {
            // mantém host e credenciais
            return {
                ...headers,
                host: origReq.headers.host as string,
            };
        },
    };

    // Rota aberta para healthcheck
    app.get('/api/health', async () => ({ ok: true }));

    // ----- AUTH (abertas) -----
    app.register(async (r) => {
        await r.register(replyFrom);
        r.all('/api/auth/*', async (req, reply) => {
            const path = req.url.replace(/^\/api\/auth/, '/auth');
            return reply.from(`${AUTH_URL}${path}`, proxyOpts);
        });
    });

    // ----- USER (protegidas) -----
    app.register(async (r) => {
        await r.register(replyFrom);

        // middleware simples de proteção por JWT no gateway
        r.addHook('onRequest', async (req, reply) => {
            // Ex.: ignorar /api/user/public/* se quiseres
            if (req.url.startsWith('/api/user')) {
                try {
                    await r.authenticate(req, reply);
                } catch {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }
            }
        });

        r.all('/api/user/*', async (req, reply) => {
            const path = req.url.replace(/^\/api\/user/, '/user');
            return reply.from(`${USER_URL}${path}`, proxyOpts);
        });
    });

    // Proxy para o serviço de realtime (presença, etc.)
    app.register(async (app) => {
        // Todas as rotas de realtime exigem JWT
        app.addHook('onRequest', app.authenticate);

        app.all('/api/realtime/*', async (req: FastifyRequest, reply: FastifyReply) => {
            const proxyOpts = {
                rewriteRequestHeaders: (originalReq: FastifyRequest, headers: Record<string, string>) => {
                    // Reencaminhar o Authorization header, se existir
                    const auth = originalReq.headers['authorization'];
                    if (auth && typeof auth === 'string') {
                        headers['authorization'] = auth;
                    }
                    return headers;
                },
            };

            const path = req.url.replace(/^\/api\/realtime/, '');
            return reply.from(`${REALTIME_URL}${path}`, proxyOpts);
        });
    });

    return app;
}

const start = async () => {
    const app = await build();
    await app.listen({ host: '0.0.0.0', port: Number(GATEWAY_PORT) });
    app.log.info(`gateway on :${GATEWAY_PORT}`);
};
start();
