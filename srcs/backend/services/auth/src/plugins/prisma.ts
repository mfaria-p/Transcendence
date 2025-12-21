// src/plugins/prisma.ts

import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import pkg from '@prisma/client';

const {PrismaClient} = pkg;
type PrismaClient = pkg.PrismaClient;

declare module 'fastify' { 
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (auth: FastifyInstance) => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  auth.decorate('prisma', prisma);
  auth.addHook('onClose', async (auth) => {
    await auth.prisma.$disconnect();
  })
});
