// src/schemas.ts

import type {FastifySchema} from 'fastify'

const profile = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    avatarUrl: {type: 'string'},
  },
  required: ['id']
};

const friendRequest = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    fromProfileId: {type: 'string'},
    toProfileId: {type: 'string'},
    status: {type: 'string'},
    message: {type: 'string'},
  },
};

const friendship = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    profileAId: {type: 'string'},
    profileBId: {type: 'string'},
  },
};

export const putProfileOpts: FastifySchema = {
  summary: 'Provide Profile Profile',
  description: '',
  body: {
    type: 'object',
    properties: {
      avatarUrl: {type: 'string'},
    }
  },
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
  summary: 'Get Profile Profile By Id',
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
  summary: 'Get Logged In Profile Profile',
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
        friendships: {
          type: 'array',
          items: friendship,
        },
      },
    },
  },
};
