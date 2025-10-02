// src/plugins/swagger.ts

import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

export default fp(async (auth, opts) => {
  await auth.register(swagger, {
    openapi: {
      info: {title: 'Auth', version: '1.0.0'},
    }
  });

  await auth.register(swaggerUI, {
    routePrefix: '/auth/docs',
    staticCSP: true,
    uiConfig: { docExpansion: 'list' }
  });
});
