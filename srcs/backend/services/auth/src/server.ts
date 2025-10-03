// src/server.ts

import type {FastifyInstance} from 'fastify'
import {buildServer} from './build.js';

const start = async (): Promise<void> => {
  const auth: FastifyInstance = await buildServer({logger: true});
  try {
    await auth.listen({host: '0.0.0.0', port: Number(process.env.AUTH_PORT)}, (err, addr) => {
      auth.log.info(`auth server listening on ${addr}`);
    });
  } catch (err) {
    auth.log.error(err);
    process.exit(1);
  }
}
start();
