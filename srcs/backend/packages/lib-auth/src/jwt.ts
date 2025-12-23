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
  interface FastifyRequest {
    jwtPayload?: {id:string; email?:string;};
  }
}

export default fp(async (auth) => {
  auth.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });
  auth.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload: {sub:string} = await req.jwtVerify();
      req.jwtPayload = {id: payload.sub as string};
    } catch {
      return reply.code(401).send({
        sucessful: false,
        message: 'Unauthorized'
      });
    }
  });
});
