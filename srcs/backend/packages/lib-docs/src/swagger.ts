// src/plugins/swagger.ts

import type {FastifyInstance} from 'fastify';
import type {FastifyDynamicSwaggerOptions} from '@fastify/swagger';
import type {FastifySwaggerUiOptions} from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

export type DocsOptions = {
  swagger?: FastifyDynamicSwaggerOptions,
  swaggerUI?: FastifySwaggerUiOptions,
}

export default fp(async (auth: FastifyInstance, opts: DocsOptions) => {
  await auth.register(swagger, {
    openapi: {
      info: {
        title: 'API',
        version: '1.0.0',
      },
    },
    ...opts.swagger ?? {},
  });

  await auth.register(swaggerUI, {
    staticCSP: true,
    uiConfig: { docExpansion: 'list' },
    ...opts?.swaggerUI ?? {},
  });
});
