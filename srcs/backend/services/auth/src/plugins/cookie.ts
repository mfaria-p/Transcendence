// src/plugins/cookie.ts

import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

export default fp(async (auth, opts) => {
  await auth.register(cookie, {hook: 'onRequest'});
});
