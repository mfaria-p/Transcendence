// src/server.ts

import type {FastifyInstance} from 'fastify'
import {buildServer} from './build.js';

const start = async (): Promise<void> => {
  const app: FastifyInstance = await buildServer({logger: true});
  try {
    await app.listen({host: '0.0.0.0', port: Number(process.env.AUTH_PORT)}, (err, addr) => {
      app.log.info(`user server listening on ${addr}`);
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  };
};
start();
