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
    const profileId: string = req.jwtPayload!.id;
    const {username, email} = req.body as {username: string, email: string};

    const profile: Profile = await utils.profileProvide(app.prisma, {id: profileId, username: username, email: email});

    return {
      success: true,
      message: 'Profile Is Provided',
      profile: profile,
    };
  });

  app.get('/', {schema: schemas.getProfilesOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profiles: Profile[] = await utils.profileFindAll(app.prisma);

    return {
      success: true,
      message: 'Public Profiles List',
      profiles: profiles,
    };
  });

  app.get('/:profileId', {schema: schemas.getProfileByIdOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {profileId} = req.params as {profileId: string};

    const profile = await utils.profileFindByProfileId(app.prisma, profileId);
    if (!profile) return reply.code(404).send({
      sucess: false,
      message: 'Nonexistent Profile Profile',
      profile: null,
    });

    return {
      success: true,
      message: 'Public Profile Profile',
      profile: profile,
    };
  });

  // useless for now
  app.get('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const profile: Profile | null = await utils.profileFindByProfileId(app.prisma, profileId);

    if (!profile) return reply.code(404).send({
      sucess: false,
      message: 'Nonexistent Profile Profile',
      profile: null,
    });

    return {
      success: true,
      message: 'Logged In Profile Profile',
      profile: profile,
    };
  });

  app.delete('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;

    const profile: Profile = await utils.profileDeleteByProfileId(app.prisma, profileId);

    return {
      success: true,
      message: 'Logged In Profile Profile',
      profile: profile,
    };
  });

  // should upsert request(?)
  app.post('/friend-request/:toProfileId', {schema: schemas.postFriendRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {toProfileId} = req.params as {toProfileId: string};
    const {message} = req.body as {message?: string};

    const request: FriendRequest = await utils.requestCreate(app.prisma, profileId, toProfileId, message);

    return {
      success: true,
      message: 'Pending Friend Requests',
      request: request,
    };
  });

  app.get('/friend-request', {schema: schemas.getRequestsOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;

    const requests: FriendRequest[] = await utils.requestFindByToProfileId(app.prisma, profileId, 'PENDING');
    
    return {
      success: true,
      message: 'Pending Friend Requests',
      requests: requests,
    };
  });

  app.post('/friend-request/:fromProfileId/accept', {schema: schemas.postAcceptRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id
    const {fromProfileId} = req.params as {fromProfileId: string};

    const request = await utils.requestUpdate(app.prisma, fromProfileId, profileId, 'ACCEPTED');
    const friend = await utils.friendCreate(app.prisma, fromProfileId, profileId);

    return {
      success: true,
      message: 'Friend Request Accepted',
      request: request,
      friendship: friend,
    };
  });

  app.post('/friend-request/:fromProfileId/decline', {schema: schemas.postDeclineRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {fromProfileId} = req.params as {fromProfileId: string};

    const request = await utils.requestDelete(app.prisma, fromProfileId, profileId, 'PENDING');

    return {
      success: true,
      message: 'Friend Request Declined',
      request: request,
    };
  });

  app.delete('/friend-request/:toProfileId', {schema: schemas.deleteRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {toProfileId} = req.params as {toProfileId: string};

    const request = await utils.requestDelete(app.prisma, profileId, toProfileId, 'PENDING');

    return {
      success: true,
      message: 'Friend Request Canceled',
      request: request,
    };
  });

  app.delete('/friend/:friendProfileId', {schema: schemas.deleteFriendOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {friendProfileId} = req.params as {friendProfileId: string};

    const friendship: Friendship = await utils.friendDelete(app.prisma, profileId, friendProfileId);

    return {
      success: true,
      message: 'Unfriended',
      friendship: friendship,
    };
  });

  app.get('/friend/:profileId', {schema: schemas.getFriendsOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {profileId} = req.params as {profileId: string};

    const friendships: Friendship[] = await utils.friendFindById(app.prisma, profileId);

    return {
      success: true,
      message: 'Public Profile Friend List',
      friendships: friendships,
    };
  });

  app.get('/friend', {schema: schemas.getFriendsOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;

    const friendships: Friendship[] = await utils.friendFindById(app.prisma, profileId);

    return {
      success: true,
      message: 'Logged In Profile Friend List',
      friendships: friendships,
    };
  });
};
