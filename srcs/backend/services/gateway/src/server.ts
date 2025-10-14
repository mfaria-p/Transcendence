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
    USERS_URL = 'http://users:3002'
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
        // necessário para Set-Cookie do serviço chegar ao browser
        onResponse: async (_, reply: FastifyReply, res) => {
            // o replyFrom já trata o pipe do body; aqui poderias mapear headers se precisares
            return reply.send(res);
        }
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

    // ----- USERS (protegidas) -----
    app.register(async (r) => {
        await r.register(replyFrom);

        // middleware simples de proteção por JWT no gateway
        r.addHook('onRequest', async (req, reply) => {
            // Ex.: ignorar /api/users/public/* se quiseres
            if (req.url.startsWith('/api/users')) {
                try {
                    await r.authenticate(req, reply);
                } catch {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }
            }
        });

        r.all('/api/users/*', async (req, reply) => {
            const path = req.url.replace(/^\/api\/users/, '/users');
            return reply.from(`${USERS_URL}${path}`, proxyOpts);
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
