// src/utils.ts

import type {FastifyInstance} from 'fastify';
import type {User, RefreshToken} from './generated/prisma/client.js';
import {Prisma} from './generated/prisma/client.js';
import createError from '@fastify/error';
import * as argon from 'argon2';
import {randomBytes, createHash} from 'crypto';

const AlreadyExistsError = createError('ALREADY_EXISTS', 'Record already exists', 409);
const InvalidRelationError = createError('INVALID_RELATION', 'Invalid reference', 400);
const NotFoundError = createError('NOT_FOUND', 'Record not found', 404);
const DatabaseError = createError('DB_ERROR', 'Database error', 500);

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

// user
export async function userCreate(db: FastifyInstance['prisma'], user: {name: string, email: string, passwordHash: string}): Promise<User> {
  try {
    return await db.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function userDeleteByEmail(db: FastifyInstance['prisma'], email: string): Promise<User> {
  try {
    return await db.user.delete({
      where: {
        email,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function userFindByEmail(db: FastifyInstance['prisma'], email: string): Promise<User | null> {
  try {
    return await db.user.findUnique({
      where: {
        email,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function userUpdatePassword(db: FastifyInstance['prisma'], id: string, pwHash: string): Promise<User | null> {
  try {
    return await db.user.update({
      where: {
        id,
      },
      data: {
        passwordHash: pwHash,
      }
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

// password hash
export async function pwHash(pw: string): Promise<string> {
  return argon.hash(pw);
};

export async function pwVerify(pwHash: string, pw: string): Promise<Boolean> {
  return argon.verify(pwHash, pw);
};

// refresh token
// revoke
export function rtGenerate(): string {
  return randomBytes(32).toString('base64url');
};

export function rtHash(rt: string): string {
  return createHash('sha256').update(rt).digest('base64url');
};

export async function rtCreate(db: FastifyInstance['prisma'], rt: string, userId: string): Promise<RefreshToken> {
  try {
    return await db.refreshToken.create({
      data: {
        tokenHash: rtHash(rt),
        userId: userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
      }
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function rtDeleteByHash(db: FastifyInstance['prisma'], rtHash: string): Promise<RefreshToken> {
  try {
    return await db.refreshToken.delete({
      where: {
        tokenHash: rtHash,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function rtDeleteByUserEmail(db: FastifyInstance['prisma'], email: string): Promise<Prisma.BatchPayload> {
  try {
    return await db.refreshToken.deleteMany({
      where: {
        user: {
          email,
        },
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function rtVerifyHash(db: FastifyInstance['prisma'], rtHash: string): Promise<RefreshToken | null> {
  try {
    return await db.refreshToken.findFirst({
      where: {
        tokenHash: rtHash,
        revokedAt: null,
        expiresAt: {gt: new Date()},
      },
      include: {user: true},
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

// access token
export function atGenerate(jwt: FastifyInstance['jwt'], payload: Object): string {
  return jwt.sign(payload, {expiresIn: '15m'});
};
