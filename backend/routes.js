// routes.js

import Items from './Items.js'

const getItemsOpts = {
  schema: {
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {type: 'number'},
            name: {type: 'string'}
          }
        }
      }
    }
  }
}

const getItemOpts = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          id: {type: 'number'},
          name: {type: 'string'}
        }
      }
    }
  }
}

const postItemOpts = {
  schema: {
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        id: {type: 'number'},
        name: {type: 'string'}
      }
    }
  }
}

async function routes (fastify, opts) {
  fastify.get('/items', getItemsOpts, async (req, reply) =>
    Items
  )

  fastify.get('/items/:id', getItemOpts, async (req, reply) =>
    Items.find((item) => item.id === req.params.id)
  )

  fastify.post('/items', postItemOpts, async (req, reply) =>
    Items[Items.push({id: String(Items.length + 1), name: req.body.name}) - 1]
  )
}

export default routes
