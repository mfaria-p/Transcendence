// src/schemas.ts

import type {FastifySchema} from 'fastify'

const profile = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    avatarUrl: {type: 'string'},
  },
  additionalProperties: false,
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
  additionalProperties: false,
};

const friendship = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    profileAId: {type: 'string'},
    profileBId: {type: 'string'},
  },
  additionalProperties: false,
};

export const putProfileOpts: FastifySchema = {
  summary: 'Provide Profile Profile',
  description: '',
  body: {
    type: 'object',
    properties: {
      avatarUrl: {type: 'string'},
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        profile: profile,
      },
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
};

export const getProfileByIdOpts: FastifySchema = {
  summary: 'Get Profile Profile By Id',
  description: '',
  params: {
    type: "object",
    properties: {
      profileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["profileId"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        profile: profile,
      },
      additionalProperties: false,
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
      additionalProperties: false,
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

export const postFriendRequestOpts: FastifySchema = {
  summary: 'Request Friendship',
  description: '',
  params: {
    type: "object",
    properties: {
      toProfileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["toProfileId"],
  },
  body: {
    type: 'object',
    properties: {
      message: {type: 'string'},
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
      },
      additionalProperties: false,
    },
  },
};

export const postAcceptRequestOpts: FastifySchema = {
  summary: 'Accept Pending Friend Request',
  description: '',
  params: {
    type: "object",
    properties: {
      fromProfileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["fromProfileId"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
        friendship: friendship,
      },
      additionalProperties: false,
    },
  },
};

export const postDeclineRequestOpts: FastifySchema = {
  summary: 'Decline Pending Friend Request',
  description: '',
  params: {
    type: "object",
    properties: {
      fromProfileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["fromProfileId"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
      },
      additionalProperties: false,
    },
  },
};

export const deleteRequestOpts: FastifySchema = {
  summary: 'Cancel Sent Friend Request',
  description: '',
  params: {
    type: "object",
    properties: {
      toProfileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["toProfileId"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        request: friendRequest,
      },
      additionalProperties: false,
    },
  },
};

export const deleteFriendOpts: FastifySchema = {
  summary: 'Unfriend',
  description: '',
  params: {
    type: "object",
    properties: {
      friendProfileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["friendProfileId"],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: {type: 'boolean'},
        message: {type: 'string'},
        friendship: friendship,
      },
      additionalProperties: false,
    },
  },
};

export const getFriendsOfProfileByIdOpts: FastifySchema = {
  summary: 'List Friends',
  description: '',
  params: {
    type: "object",
    properties: {
      profileId: { type: "string" },
    },
    additionalProperties: false,
    required: ["profileId"],
  },
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
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
};
