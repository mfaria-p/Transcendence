// src/utils.ts

import type {FastifyInstance} from 'fastify';
import type {Profile, FriendRequest, FriendRequestStatus, Friendship, Block} from './generated/prisma/client.js';
import {Prisma} from './generated/prisma/client.js';
import createError from '@fastify/error';

const AlreadyExistsError = createError('ALREADY_EXISTS', 'Record already exists', 409);
const NotFoundError = createError('NOT_FOUND', 'Record not found', 404);
const InvalidRelationError = createError('INVALID_RELATION', 'Invalid relation reference', 400);
const DatabaseError = createError('DATABASE_ERROR', 'Database operation failed', 500);

function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': throw new AlreadyExistsError();
      case 'P2003':
      case 'P2014': throw new InvalidRelationError();
      case 'P2001':
      case 'P2025': throw new NotFoundError();
      default: throw new DatabaseError(`Unhandled Prisma error: ${error.code}`);
    }
  }
  if (error instanceof Prisma.PrismaClientRustPanicError || error instanceof Prisma.PrismaClientInitializationError) {
    throw new DatabaseError('Critical database failure');
  }
  throw new DatabaseError();
}

// profile
export async function profileProvide(db: FastifyInstance['prisma'], user: {id: string, name: string, email: string}): Promise<Profile> {
  try {
    return await db.profile.upsert({
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
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function profileDeleteByUserId(db: FastifyInstance['prisma'], id: string): Promise<Profile> {
  try {
    return await db.profile.delete({
      where: {
        id,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function profileFindByUserId(db: FastifyInstance['prisma'], id: string): Promise<Profile | null> {
  try {
    return await db.profile.findUnique({
      where: {
        id,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function profileFindAll(db: FastifyInstance['prisma']): Promise<Profile[]> {
  try {
    return await db.profile.findMany();
  } catch(err) {
    handlePrismaError(err);
  };
};

// friend
export async function friendCreate(db: FastifyInstance['prisma'], id1: string, id2: string): Promise<Friendship> {
  const userIds: [string, string] = id1 < id2 ? [id1,id2] : [id2,id1];

  try {
    return await db.friendship.create({
      data: {
        userAId: userIds[0],
        userBId: userIds[1],
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function friendDelete(db: FastifyInstance['prisma'], id1: string, id2: string): Promise<Friendship> {
  const userIds: [string, string] = id1 < id2 ? [id1,id2] : [id2,id1];

  try {
    return await db.friendship.delete({
      where: {
        userAId_userBId: {
          userAId: userIds[0],
          userBId: userIds[1],
        },
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function friendFindById(db: FastifyInstance['prisma'], id: string): Promise<Friendship[]> {
  try {
    return await db.friendship.findMany({
      where: {
        OR: [
          {userAId: id},
          {userBId: id},
        ],
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

// friend request
export async function requestCreate(db: FastifyInstance['prisma'], fromId: string, toId: string, message: string = ''): Promise<FriendRequest> {
  try {
    return await db.friendRequest.create({
      data: {
        fromUserId: fromId,
        toUserId: toId,
        message: message,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestUpdate(db: FastifyInstance['prisma'], fromId: string, toId: string, status: FriendRequestStatus): Promise<FriendRequest> {
  try {
    return await db.friendRequest.update({
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
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestFindByUserIds(db: FastifyInstance['prisma'], fromId: string, toId: string, status?: string): Promise<FriendRequest | null> {
  const where: any = {fromUserId_toUserId: {fromUserId: fromId, toUserId: toId}};
  if (status) where.status = status;

  try {
    return await db.friendRequest.findUnique({
      where,
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestFindByToUserId(db: FastifyInstance['prisma'], userId: string, status?: string): Promise<FriendRequest[]> {
  const where: any = {toUserId: userId};
  if (status) where.status = status;
  try {
    return await db.friendRequest.findMany({
      where
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestDelete(db: FastifyInstance['prisma'], fromUserId: string, toUserId: string, status?: string): Promise<FriendRequest | null> {
  const where: any = {
    fromUserId_toUserId: {
      fromUserId: fromUserId,
      toUserId: toUserId,
    },
  };
  if (status) where.status = status;

  try {
    return await db.friendRequest.delete({
      where
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

// block
export async function blockCreate(db: FastifyInstance['prisma'], blockerId: string, blockedId: string, reason: string = ''): Promise<Block> {
  try {
    return await db.block.create({
      data: {
        blockerId: blockerId,
        blockedId: blockedId,
        reason: reason,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function blockDelete(db: FastifyInstance['prisma'], blockerId: string, blockedId: string): Promise<Block> {
  try {
    return await db.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId: blockerId,
          blockedId: blockedId,
        }
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function blockFindByBlockerId(db: FastifyInstance['prisma'], blockerId: string): Promise<Block[]> {
  try {
    return await db.block.findMany({
      where: {
        blockerId: blockerId,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};
