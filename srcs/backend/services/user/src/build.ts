// src/build.ts

import type {FastifyInstance, FastifyServerOptions, FastifyError, FastifyRequest, FastifyReply} from 'fastify';
import Fastify from 'fastify';
import swagger from '@pkg/lib-docs';
import jwt from '@pkg/lib-auth';
import prisma from './plugins/prisma.js';
import routes from './routes.js';

export async function buildServer(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({logger: false, ...opts});

  await app.register(swagger, {swagger: {openapi: {info: {title: 'User', version: '1.0.0'}}}, swaggerUI: {routePrefix: '/user/docs'}});
  await app.register(prisma);
  await app.register(jwt);
  await app.register(routes, {prefix: '/user'});

  app.setErrorHandler((error: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
    const status = error.statusCode ?? 500;

    reply.status(status).send({
      success: false,
      code: error.code ?? 'INTERNAL_ERROR',
      message: error.message,
    });
  });

  return app;
}
