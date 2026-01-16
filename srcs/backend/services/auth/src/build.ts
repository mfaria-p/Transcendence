// src/build.ts

import type {FastifyInstance, FastifyServerOptions} from 'fastify';
import Fastify from 'fastify';
import swagger from '@pkg/lib-docs';
import cookie from './plugins/cookie.js';
import jwt from '@pkg/lib-auth';
import prisma from './plugins/prisma.js';
import routes from './routes.js';

export async function buildServer(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({logger: false, ...opts});

  await app.register(swagger, {swagger: {openapi: {info: {title: 'Auth', version: '1.0.0'}}}, swaggerUI: {routePrefix: '/auth/docs'}});
  await app.register(prisma);
  await app.register(cookie);
  await app.register(jwt);
  await app.register(routes, {prefix: '/auth'});

  return app;
}
