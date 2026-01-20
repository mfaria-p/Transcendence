// src/routes.ts

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {Profile, FriendRequest, FriendRequestStatus, Friendship} from './generated/prisma/client.js';
import * as schemas from './schemas.js';
import * as utils from './utils.js';
import { emitUserEvent } from './realtime.js';

export default async function (app: FastifyInstance): Promise<void> {
  app.put('/provision', {schema: schemas.putProfileOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {avatarUrl} = req.body as {avatarUrl: string};

    const profile: Profile = await utils.profileProvide(app.prisma, {id: profileId, ...(avatarUrl && {avatarUrl})});

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
      message: 'Nonexistent Profile',
      profile: null,
    });

    return {
      success: true,
      message: 'Public Profile',
      profile: profile,
    };
  });

  app.get('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const profile: Profile | null = await utils.profileFindByProfileId(app.prisma, profileId);

    if (!profile) return reply.code(404).send({
      sucess: false,
      message: 'Nonexistent Profile',
      profile: null,
    });

    return {
      success: true,
      message: 'Logged In Profile',
      profile: profile,
    };
  });

  app.delete('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;

    const profile: Profile = await utils.profileDeleteById(app.prisma, profileId);

    return {
      success: true,
      message: 'Logged In Profile',
      profile: profile,
    };
  });

  // should upsert request(?)
  app.post('/friend-request/:toProfileId', {schema: schemas.postFriendRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {toProfileId} = req.params as {toProfileId: string};
    const {message} = req.body as {message?: string};

    const request: FriendRequest = await utils.requestCreate(app.prisma, profileId, toProfileId, message);
    // Realtime notification (best-effort)
    void emitUserEvent([toProfileId], 'friend_request:received', { fromProfileId: profileId });
    void emitUserEvent([profileId], 'friend_request:sent', { toProfileId });

    return {
      success: true,
      message: 'Pending Friend Requests',
      request: request,
    };
  });

  app.get('/friend-request/received', {schema: schemas.getRequestsOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;

    const requests: FriendRequest[] = await utils.requestFindByToProfileId(app.prisma, profileId, 'PENDING');
    
    return {
      success: true,
      message: 'Pending Received Friend Requests',
      requests: requests,
    };
  });

  app.get('/friend-request/sent', {schema: schemas.getRequestsOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;

    const requests: FriendRequest[] = await utils.requestFindByFromProfileId(app.prisma, profileId, 'PENDING');
    
    return {
      success: true,
      message: 'Pending Sent Friend Requests',
      requests: requests,
    };
  });

  app.post('/friend-request/:fromProfileId/accept', {schema: schemas.postAcceptRequestOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id
    const {fromProfileId} = req.params as {fromProfileId: string};

    const request = await utils.requestUpdate(app.prisma, fromProfileId, profileId, 'ACCEPTED');
    const friend = await utils.friendCreate(app.prisma, fromProfileId, profileId);
    // Realtime notification (best-effort)
    void emitUserEvent([fromProfileId, profileId], 'friend_request:accepted', { fromProfileId, toProfileId: profileId });
    void emitUserEvent([fromProfileId, profileId], 'friendship:created', { profileIdA: fromProfileId, profileIdB: profileId });

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

    // Realtime notification (best-effort)
    void emitUserEvent([fromProfileId, profileId], 'friend_request:declined', { fromProfileId, toProfileId: profileId });


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

    // Realtime notification (best-effort)
    void emitUserEvent([toProfileId, profileId], 'friend_request:canceled', { fromProfileId: profileId, toProfileId });


    return {
      success: true,
      message: 'Friend Request Canceled',
      request: request,
    };
  });

  app.delete('/friend/:friendProfileId', {schema: schemas.deleteFriendOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const profileId: string = req.jwtPayload!.id;
    const {friendProfileId} = req.params as {friendProfileId: string};

    try {
      await utils.requestDelete(app.prisma, profileId, friendProfileId);
    } catch (err) {}
    try {
      await utils.requestDelete(app.prisma, friendProfileId, profileId, 'ACCEPTED');
    } catch (err) {}
    const friendship = await utils.friendDelete(app.prisma, profileId, friendProfileId);

    // Realtime notification (best-effort)
    void emitUserEvent([profileId, friendProfileId], 'friendship:deleted', { profileIdA: profileId, profileIdB: friendProfileId });


    return {
      success: true,
      message: 'Unfriended',
      // request: request,
      friendship: friendship,
    };
  });

  app.get('/friend/:profileId', {schema: schemas.getFriendsOfProfileByIdOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
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
