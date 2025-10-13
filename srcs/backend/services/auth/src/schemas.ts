// src/schemas.ts

import type {FastifySchema} from 'fastify'

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
}

// should require rt cookie
export const postLogoutOpts: FastifySchema = {
  summary: 'End session',
  description: '',
}
