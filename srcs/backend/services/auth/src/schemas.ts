// src/schemas.ts

import type {FastifySchema} from 'fastify'

const account = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    username: {type: 'string'},
    email: {type: 'string'},
    avatarUrl: {type: 'string'},
  },
  required: ['id', 'username', 'email'],
};

export const getMeOpts: FastifySchema = {
  summary: 'Get account info',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        account: account,
      }
    },
  },
};

export const putMeOpts: FastifySchema = {
  summary: 'Update Username and Email',
  description: '',
  body: {
    type: 'object',
    properties: {
      username: {type: 'string'},
      email: {type: 'string'},
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        account: account,
      }
    },
  },
};

export const putMePasswordOpts: FastifySchema = {
  summary: 'Update Password',
  description: '',
  body: {
    type: 'object',
    required: ['currentPassword','newPassword'],
    properties: {
      currentPassword: {type: 'string'},
      newPassword: {type: 'string'},
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        account: account,
      }
    },
  },
};

export const deleteMeOpts: FastifySchema = {
  summary: 'Delete Account',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        account: account,
      }
    },
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
    required: ['username', 'email', 'password'],
    properties: {
      username: {type: 'string'},
      email: {type: 'string'},
      password: {type: 'string'},
    },
    additionalProperties: false,
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
    required: ['ident', 'password'],
    properties: {
      ident: {type: 'string'},
      password: {type: 'string'},
    },
    additionalProperties: false,
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
