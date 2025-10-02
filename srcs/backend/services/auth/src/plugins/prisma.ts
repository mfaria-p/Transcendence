// src/plugins/prisma.ts

import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

export default fp(async (auth, opts) => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  auth.decorate('prisma', prisma);
  auth.addHook('onClose', async (auth) => {
    await auth.prisma.$disconnect();
  })
});
