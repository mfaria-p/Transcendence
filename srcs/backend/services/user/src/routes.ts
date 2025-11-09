// src/routes.ts

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {Profile, FriendRequest, FriendRequestStatus, Friendship, Block} from './generated/prisma/client.js';
import * as schemas from './schemas.js';
import * as utils from './utils.js';

export default async function (app: FastifyInstance): Promise<void> {
  // TODO
  // blocking does nothing
  

  // should be event driven
  // requires broker service...
  app.put('/provision', {schema: schemas.putProfileOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;
    const {username, email} = req.body as {username: string, email: string};

    const profile: Profile = await utils.profileProvide(app.prisma, {id: userId, name: username, email: email});

    return {
      success: true,
      message: "Profile Is Provided",
      profile: profile,
    };
  });

  app.get('/', {schema: schemas.getProfilesOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profiles: Profile[] = await utils.profileFindAll(app.prisma);

    return {
      success: true,
      message: "Public Profiles List",
      profiles: profiles,
    };
  });

  app.get('/:userId', {schema: schemas.getProfileByIdOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {userId} = req.params as {userId: string};

    const profile = await utils.profileFindByUserId(app.prisma, userId);
    if (!profile) return reply.code(404).send({
      sucess: false,
      message: 'Nonexistent User Profile',
      profile: null,
    });

    return {
      success: true,
      message: "Public User Profile",
      profile: profile,
    };
  });

  // useless for now
  app.get('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;

    const profile: Profile | null = await utils.profileFindByUserId(app.prisma, userId);
    if (!profile) return reply.code(404).send({
      sucess: false,
      message: 'Nonexistent User Profile',
      profile: null,
    });

    return {
      success: true,
      message: "Logged In User Profile",
      profile: profile,
    };
  });

  app.delete('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;

    const profile: Profile = await utils.profileDeleteByUserId(app.prisma, userId);

    return {
      success: true,
      message: "Logged In User Profile",
      profile: profile,
    };
  });

  // should upsert request(?)
  app.post('/friend-request/:toUserId', {schema: schemas.postFriendRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;
    const {toUserId} = req.params as {toUserId: string};
    const {message} = req.body as {message?: string};

    const request: FriendRequest = await utils.requestCreate(app.prisma, userId, toUserId, message);

    return {
      success: true,
      message: "Pending Friend Requests",
      request: request,
    };
  });

  app.get('/friend-request', {schema: schemas.getRequestsOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;

    const requests: FriendRequest[] = await utils.requestFindByToUserId(app.prisma, userId, 'PENDING');
    
    return {
      success: true,
      message: "Pending Friend Requests",
      requests: requests,
    };
  });

  app.post('/friend-request/:fromUserId/accept', {schema: schemas.postAcceptRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id
    const {fromUserId} = req.params as {fromUserId: string};

    const request = await utils.requestUpdate(app.prisma, fromUserId, userId, 'ACCEPTED');
    const friend = await utils.friendCreate(app.prisma, fromUserId, userId);

    return {
      success: true,
      message: "Friend Request Accepted",
      request: request,
      friendship: friend,
    };
  });

  app.post('/friend-request/:fromUserId/decline', {schema: schemas.postDeclineRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;
    const {fromUserId} = req.params as {fromUserId: string};

    const request = await utils.requestDelete(app.prisma, fromUserId, userId, 'PENDING');

    return {
      success: true,
      message: "Friend Request Declined",
      request: request,
    };
  });

  app.delete('/friend-request/:toUserId', {schema: schemas.deleteRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;
    const {toUserId} = req.params as {toUserId: string};

    const request = await utils.requestDelete(app.prisma, userId, toUserId, 'PENDING');

    return {
      success: true,
      message: "Friend Request Canceled",
      request: request,
    };
  });

  app.delete('/friend/:friendUserId', {schema: schemas.deleteFriendOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;
    const {friendUserId} = req.params as {friendUserId: string};

    const friendship: Friendship = await utils.friendDelete(app.prisma, userId, friendUserId);

    return {
      success: true,
      message: "Unfriended",
      friendship: friendship,
    };
  });

  app.get('/friend/:userId', {schema: schemas.getFriendsOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {userId} = req.params as {userId: string};

    const friendships: Friendship[] = await utils.friendFindById(app.prisma, userId);

    return {
      success: true,
      message: "Public User Friend List",
      friendships: friendships,
    };
  });

  app.get('/friend', {schema: schemas.getFriendsOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId: string = req.jwtPayload!.id;

    const friendships: Friendship[] = await utils.friendFindById(app.prisma, userId);

    return {
      success: true,
      message: "Logged In User Friend List",
      friendships: friendships,
    };
  });
};
