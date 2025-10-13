// src/schemas.ts

import type {FastifySchema} from 'fastify'

const user = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    username: {type: 'string'},
    email: {type: 'string'},
  },
}

export const postMeOpts: FastifySchema = {
  summary: 'Get user info',
  description: '',
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {type: 'string'},
    }
  },
}

export const postSignupOpts: FastifySchema = {
  summary: 'Create user',
  description: '',
  body: {
    type: 'object',
    required: ['username','email', 'password'],
    properties: {
      username: {type: 'string'},
      email: {type: 'string'},
      password: {type: 'string'},
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        user: user,
      },
    },
  },
}

export const postLoginOpts: FastifySchema = {
  summary: 'Login with email',
  description: '',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {type: 'string'},
      password: {type: 'string'},
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        user: user,
        at: {type: 'string'},
      },
    },
    401: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
    },
  },
}

// TODO
// should require rt cookie
export const postRefreshOpts: FastifySchema = {
  summary: 'Refresh session',
  description: `
    rotates refresh token
    returns JWT token
  `,
  // cookies: {
  //   type: 'object',
  //   required: ['refresh_token'],
  //   properties: {
  //     refresh_token: {type: 'string'},
  //   }
  // },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        at: {type: 'string'},
      },
    },
    401: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
    },
  },
}

// should require rt cookie
export const postLogoutOpts: FastifySchema = {
  summary: 'End session',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
    },
    401: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
    },
  },
}
