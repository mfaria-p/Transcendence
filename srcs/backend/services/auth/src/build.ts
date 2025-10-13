// src/build.ts

import type {FastifyInstance, FastifyServerOptions} from 'fastify';
import Fastify from 'fastify';
import swagger from './plugins/swagger.js';
import cookie from './plugins/cookie.js';
import jwt from '@pkg/lib-auth';
// import oauth2 from '@fastify/oauth2';
import prisma from './plugins/prisma.js';
import routes from './routes.js';
import * as dotenv from 'dotenv';
dotenv.config();

export async function buildServer(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const auth = Fastify({logger: false, ...opts});

  await auth.register(swagger);
  await auth.register(prisma);
  await auth.register(cookie);
  await auth.register(jwt);
  await auth.register(routes, {prefix: '/auth'});

  return auth;
}
