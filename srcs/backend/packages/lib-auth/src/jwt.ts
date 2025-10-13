// src/jwt.ts

import type {FastifyRequest, FastifyReply} from 'fastify';
import type {JWT} from '@fastify/jwt';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';


declare module 'fastify' { 
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): void;
    jwt: JWT;
  }
}

// TODO
// use private/public key pair
export default fp(async (auth) => {
  auth.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });
  auth.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({error: 'Unauthorized'});
    }
  });
});
