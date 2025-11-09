// src/schemas.ts

import type {FastifySchema} from 'fastify'

const user = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    username: {type: 'string'},
    email: {type: 'string'},
  },
};

const profile = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    name: {type: 'string'},
    email: {type: 'string'},
    avatarUrl: {type: 'string'},
  },
};

const friendRequest = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    fromUserId: {type: 'string'},
    toUserId: {type: 'string'},
    status: {type: 'string'},
    message: {type: 'string'},
  },
};

const friendship = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    userAId: {type: 'string'},
    userBId: {type: 'string'},
  },
};

// TODO
// fields according to db table
const block = {};

export const putProfileOpts: FastifySchema = {
  summary: 'Provide User Profile',
  description: '',
  body: {
    type: 'object',
    required: ['username','email'],
    properties: {
      username: {type: 'string'},
      email: {type: 'string'},
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        profile: user,
      },
    },
  },
};

export const getProfilesOpts: FastifySchema = {
  summary: 'Get Profile List',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        profiles: {
          type: 'array',
          items: profile,
        },
      },
    },
  },
};

export const getProfileByIdOpts: FastifySchema = {
  summary: 'Get User Profile By Id',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        profile: profile,
      },
    },
  },
};

export const getRequestsOpts: FastifySchema = {
  summary: 'Get Pending Request List',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        requests: {
          type: 'array',
          items: friendRequest,
        },
      },
    },
  },
};

export const getMeOpts: FastifySchema = {
  summary: 'Get Logged In User Profile',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        profile: profile,
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

export const postFriendRequestOpts: FastifySchema = {
  summary: 'Request Friendship',
  description: '',
  body: {
    type: 'object',
    properties: {
      message: {type: 'string'},
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
      },
    },
  },
};

export const postAcceptRequestOpts: FastifySchema = {
  summary: 'Accept Pending Friend Request',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
        friendship: friendship,
      },
    },
  },
};

export const postDeclineRequestOpts: FastifySchema = {
  summary: 'Decline Pending Friend Request',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
      },
    },
  },
};

export const deleteRequestOpts: FastifySchema = {
  summary: 'Cancel Sent Friend Request',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
      },
    },
  },
};

export const deleteFriendOpts: FastifySchema = {
  summary: 'Unfriend',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        friendship: friendship,
      },
    },
  },
};

export const getFriendsOpts: FastifySchema = {
  summary: 'List Friends',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        friendship: {
          type: 'array',
          items: friendship,
        },
      },
    },
  },
};

export const postBlockOpts: FastifySchema = {
  summary: 'Block User',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        block: block,
      },
    },
  },
};

export const deleteBlockOpts: FastifySchema = {
  summary: 'Unblock User',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        block: block,
      },
    },
  },
};

export const getBlocksOpts: FastifySchema = {
  summary: 'Get Block List',
  description: '',
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        block: {
          type: 'array',
          items: block,
        },
      },
    },
  },
};
