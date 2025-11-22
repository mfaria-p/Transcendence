// src/server.ts

import type { FastifyInstance } from 'fastify';
import { buildServer } from './build.js';

const start = async (): Promise<void> => {
    const app: FastifyInstance = await buildServer({ logger: true });
    const port = Number(process.env.WS_PORT ?? '3003');

    try {
        await app.listen(
            { host: '0.0.0.0', port },
            (err, addr) => {
                if (err) {
                    app.log.error(err);
                    process.exit(1);
                }
                app.log.info(`ws server listening on ${addr}`);
            },
        );
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
