// src/plugins/jwt.ts

import type {FastifyRequest, FastifyReply} from 'fastify'
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

declare module 'fastify' { 
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): void;
  }
}

// TODO
// use private/public key pair
export default fp(async (auth) => {
  auth.register(jwt as any, {
    secret: process.env.JWT_SECRET!,
    sign: {issuer: 'auth-svc'},
    verify: {issuer: 'auth-svc'},
  });
  auth.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({error: 'Unauthorized'});
    }
  });
});
