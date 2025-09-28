// server.js

import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import routes from './routes.js'

const PORT = 3000

const fastify = Fastify({
  logger: true
})

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'My API',
      description: 'Fastify + Swagger example',
      version: '1.0.0'
    }
  }
});

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
  staticCSP: true,
  uiConfig: { docExpansion: 'list' }
});

fastify.register(routes)

const start = async () => {
  try {
    await fastify.listen({port:PORT, host:'localhost'}, (err,addr) => {
      fastify.log.info(`server listening on ${addr}`)
    })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
