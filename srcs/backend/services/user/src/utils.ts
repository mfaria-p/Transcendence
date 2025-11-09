// src/utils.ts

import type {FastifyInstance} from 'fastify';
import type {Profile, FriendRequest, FriendRequestStatus, Friendship, Block} from './generated/prisma/client.js';

// profile
export async function profileProvide(db: FastifyInstance['prisma'], user: {id: string, name: string, email: string}): Promise<Profile> {
  return db.profile.upsert({
    where: {
      id: user.id
    },
    create: {
      id:   user.id,
      name: user.name,
      email: user.email,
    },
    update: {
      name: user.name,
      email: user.email,
    },
  });
};

export async function profileDeleteByEmail(db: FastifyInstance['prisma'], id: string): Promise<Profile> {
  return db.profile.delete({
    where: {
      id,
    },
  });
};

export async function profileFindByUserId(db: FastifyInstance['prisma'], id: string): Promise<Profile | null> {
  return db.profile.findUnique({
    where: {
      id,
    },
  });
};

export async function profileFindAll(db: FastifyInstance['prisma']): Promise<Profile[]> {
  return db.profile.findMany();
};

// friend
export async function friendCreate(db: FastifyInstance['prisma'], id1: string, id2: string): Promise<Friendship> {
  const userIds: [string, string] = id1 < id2 ? [id1,id2] : [id2,id1];

  return db.friendship.create({
    data: {
      userAId: userIds[0],
      userBId: userIds[1],
    },
  });
};

export async function friendDelete(db: FastifyInstance['prisma'], id1: string, id2: string): Promise<Friendship> {
  const userIds: [string, string] = id1 < id2 ? [id1,id2] : [id2,id1];

  return db.friendship.delete({
    where: {
      userAId_userBId: {
        userAId: userIds[0],
        userBId: userIds[1],
      },
    },
  });
};

export async function friendFindById(db: FastifyInstance['prisma'], id: string): Promise<Friendship[]> {
  return db.friendship.findMany({
    where: {
      OR: [
        {userAId: id},
        {userBId: id},
      ],
    },
  });
};

// friend request
export async function requestCreate(db: FastifyInstance['prisma'], fromId: string, toId: string, message: string = ''): Promise<FriendRequest> {
  return db.friendRequest.create({
    data: {
      fromUserId: fromId,
      toUserId: toId,
      message: message,
    },
  });
};

export async function requestUpdate(db: FastifyInstance['prisma'], fromId: string, toId: string, status: FriendRequestStatus): Promise<FriendRequest> {
  return db.friendRequest.update({
    where: {
      fromUserId_toUserId: {
        fromUserId: fromId,
        toUserId: toId,
      },
    },
    data: {
      status: status,
    },
  });
};

export async function requestFindByUserIds(db: FastifyInstance['prisma'], fromId: string, toId: string, status?: string): Promise<FriendRequest> {
  const where: any = {fromUserId_toUserId: {fromUserId: fromId, toUserId: toId}};
  if (status) where.status = status;
  return db.friendRequest.findUnique({
    where,
  });
};

export async function requestFindByToUserId(db: FastifyInstance['prisma'], userId: string, status?: string): Promise<FriendRequest[]> {
  const where: any = {toUserId: userId};
  if (status) where.status = status;
  return db.friendRequest.findMany({
    where
  });
};

export async function requestDelete(db: FastifyInstance['prisma'], fromUserId: string, toUserId: string, status?: string): Promise<FriendRequest | null> {
  const where: any = {
    fromUserId_toUserId: {
      fromUserId: fromUserId,
      toUserId: toUserId,
    },
  };
  if (status) where.status = status;
  return db.friendRequest.delete({
    where
  });
};

// block
export async function blockCreate(db: FastifyInstance['prisma'], blockerId: string, blockedId: string, reason: string = ''): Promise<Block> {
  return db.block.create({
    data: {
      blockerId: blockerId,
      blockedId: blockedId,
      reason: reason,
    },
  });
};

export async function blockDelete(db: FastifyInstance['prisma'], blockerId: string, blockedId: string): Promise<Block> {
  return db.block.delete({
    where: {
      blockerId_blockedId: {
        blockerId: blockerId,
        blockedId: blockedId,
      }
    },
  });
};

export async function blockFindByBlockerId(db: FastifyInstance['prisma'], blockerId: string): Promise<Block[]> {
  return db.block.findMany({
    where: {
      blockerId: blockerId,
    },
  });
};
