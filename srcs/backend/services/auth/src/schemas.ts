// src/schemas.ts

import type {FastifySchema} from 'fastify'

const account = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    email: {type: 'string'},
    username: {type: 'string'},
    avatarUrl: {type: 'string'},
  },
  required: ['id', 'email'],
};

export const postMeOpts: FastifySchema = {
  summary: 'Get account info',
  description: '',
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {type: 'string'},
    }
  },
};

export const postGoogleAuthOpts: FastifySchema = {
  summary: 'Google remote login',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        account: account,
        at: {type: 'string'},
      },
    },
  },
};

export const postSignupOpts: FastifySchema = {
  summary: 'Create account',
  description: '',
  body: {
    type: 'object',
    required: ['email', 'password'],
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
        account: account,
        at: {type: 'string'},
      },
    },
  },
};

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
        account: account,
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
};

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
};

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
