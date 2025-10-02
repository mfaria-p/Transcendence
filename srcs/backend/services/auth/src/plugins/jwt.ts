// src/plugins/jwt.ts

import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (auth, opts) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("Missing JWT_SECRET in environment");
  await auth.register(jwt, {
    secret: jwtSecret,
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
