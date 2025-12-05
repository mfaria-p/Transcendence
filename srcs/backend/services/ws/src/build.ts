// src/build.ts

import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import Fastify from 'fastify';
import * as dotenv from 'dotenv';
import jwt from '@pkg/lib-auth';
import websocket from '@fastify/websocket';
import routes from './routes.js';

dotenv.config();

export async function buildServer(
    opts: FastifyServerOptions = {},
): Promise<FastifyInstance> {
    const app = Fastify({ logger: false, ...opts });

    // Reutiliza o mesmo plugin JWT que já tens
    await app.register(jwt);

    // Plugin de WebSocket
    await app.register(websocket, {
        options: {
            maxPayload: 1024 * 1024 // 1MB, ajusta se precisares
        }
    });

    // Registo das rotas HTTP + WS (sem prefix, usamos paths absolutos)
    await app.register(routes);

    return app;
}
