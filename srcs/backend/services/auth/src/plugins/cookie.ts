// src/plugins/cookie.ts

import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

export default fp(async (auth: FastifyInstance) => {
  await auth.register(cookie, {hook: 'onRequest'});
});
