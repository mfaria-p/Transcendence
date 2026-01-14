// src/utils.ts

import type {FastifyInstance} from 'fastify';
import type {Profile, FriendRequest, FriendRequestStatus, Friendship} from '@prisma/client';
import {Prisma} from '@prisma/client';
import createError from '@fastify/error';

const AlreadyExistsError = createError('ALREADY_EXISTS', 'Record already exists', 409);
const NotFoundError = createError('NOT_FOUND', 'Record not found', 404);
const InvalidRelationError = createError('INVALID_RELATION', 'Invalid relation reference', 400);
const DatabaseError = createError('DATABASE_ERROR', 'Database operation failed', 500);

function handlePrismaError(error: any): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        {
          const targetFields = (error.meta?.target as string[]) || [];
          const fieldList = targetFields.join(', ') || 'unknown field';
          throw new AlreadyExistsError(`${fieldList} already exists`);
        }
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
export async function profileProvide(db: FastifyInstance['prisma'], profile: {id: string, avatarUrl?: string}): Promise<Profile> {
  try {
    let createData: any = {
      id: profile.id,
    };
    
    let updateData: any = {};
    
    if (profile?.avatarUrl) {
      createData.avatarUrl = profile.avatarUrl;
      updateData.avatarUrl = profile.avatarUrl;
    }
    
    return await db.profile.upsert({
      where: {
        id: profile.id
      },
      create: createData,
      update: updateData,
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function profileDeleteById(db: FastifyInstance['prisma'], id: string): Promise<Profile> {
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

export async function profileFindByProfileId(db: FastifyInstance['prisma'], id: string): Promise<Profile | null> {
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
  const profileIds: [string, string] = id1 < id2 ? [id1,id2] : [id2,id1];

  try {
    return await db.friendship.create({
      data: {
        profileAId: profileIds[0],
        profileBId: profileIds[1],
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function friendDelete(db: FastifyInstance['prisma'], id1: string, id2: string): Promise<Friendship> {
  const profileIds: [string, string] = id1 < id2 ? [id1,id2] : [id2,id1];

  try {
    return await db.friendship.delete({
      where: {
        profileAId_profileBId: {
          profileAId: profileIds[0],
          profileBId: profileIds[1],
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
          {profileAId: id},
          {profileBId: id},
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
        fromProfileId: fromId,
        toProfileId: toId,
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
        fromProfileId_toProfileId: {
          fromProfileId: fromId,
          toProfileId: toId,
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

export async function requestFindByProfileIds(db: FastifyInstance['prisma'], fromId: string, toId: string, status?: string): Promise<FriendRequest | null> {
  const where: any = {fromProfileId_toProfileId: {fromProfileId: fromId, toProfileId: toId}};
  if (status) where.status = status;

  try {
    return await db.friendRequest.findUnique({
      where,
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestFindByToProfileId(db: FastifyInstance['prisma'], profileId: string, status?: string): Promise<FriendRequest[]> {
  const where: any = {toProfileId: profileId};
  if (status) where.status = status;
  try {
    return await db.friendRequest.findMany({
      where,
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestFindByFromProfileId(db: FastifyInstance['prisma'], profileId: string, status?: string): Promise<FriendRequest[]> {
  const where: any = {fromProfileId: profileId};
  if (status) where.status = status;
  try {
    return await db.friendRequest.findMany({
      where,
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function requestDelete(db: FastifyInstance['prisma'], fromProfileId: string, toProfileId: string, status?: string): Promise<FriendRequest | null> {
  const where: any = {
    fromProfileId_toProfileId: {
      fromProfileId: fromProfileId,
      toProfileId: toProfileId,
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
