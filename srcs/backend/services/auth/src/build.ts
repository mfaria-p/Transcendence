// src/build.ts

import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyServerOptions,
} from 'fastify';
import swagger from './plugins/swagger';
import cookie from './plugins/cookie';
import jwt from './plugins/jwt';
// import oauth2 from '@fastify/oauth2';
import prisma from './plugins/prisma';
import routes from './routes';
import dotenv from 'dotenv';
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
