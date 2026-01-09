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
  additionalProperties: false,
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
        isOAuthAccount: {type: 'boolean'},
      },
      additionalProperties: false,
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
      },
      additionalProperties: false,
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
      },
      additionalProperties: false,
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
      },
      additionalProperties: false,
    },
  },
};

export const getAccountsOpts: FastifySchema = {
  summary: 'Get Account List',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        accounts: {
          type: 'array',
          items: account,
        },
      },
      additionalProperties: false,
    },
  },
};

export const getAccountByIdOpts: FastifySchema = {
  summary: 'Get Account By Id',
  description: '',
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    additionalProperties: false,
    required: ["id"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        account: account,
      },
      additionalProperties: false,
    },
  },
};


export const getAccountsByIdentPrefixOpts: FastifySchema = {
  summary: 'Get Account List',
  description: '',
  querystring: {
    type: "object",
    properties: {
      prefix: { type: "string", minLength: 1 },
      limit: { type: "number", default: 20 },
      page: { type: "number", default: 1 },
    },
    additionalProperties: false,
    required: ["prefix"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        accounts: {
          type: 'array',
          items: account,
        },
      },
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
    },
    401: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
      additionalProperties: false,
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
      additionalProperties: false,
    },
    401: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
      additionalProperties: false,
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
      additionalProperties: false,
    },
    401: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
      },
      additionalProperties: false,
    },
  },
}
