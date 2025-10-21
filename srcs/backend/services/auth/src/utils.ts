// src/utils.ts

import type {FastifyInstance} from 'fastify';
import type {User, RefreshToken, Prisma} from './generated/prisma/client.js';
import * as argon from 'argon2';
import {randomBytes, createHash} from 'crypto';

// user
export async function userCreate(db: FastifyInstance['prisma'], user: {name: string, email: string, passwordHash: string}): Promise<User> {
  return db.user.create({
    data: {
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
    },
  });
};

export async function userDeleteByEmail(db: FastifyInstance['prisma'], email: string): Promise<User> {
  rtDeleteByUserEmail(db, email);
  return db.user.delete({
    where: {
      email,
    },
  });
};

export async function userFindByEmail(db: FastifyInstance['prisma'], email: string): Promise<User | null> {
  return db.user.findUnique({
    where: {
      email,
    },
  });
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
  return db.refreshToken.create({
    data: {
      tokenHash: rtHash(rt),
      userId: userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    }
  });
};

export async function rtDeleteByHash(db: FastifyInstance['prisma'], rtHash: string): Promise<RefreshToken> {
  return db.refreshToken.delete({
    where: {
      tokenHash: rtHash,
    },
  });
};

export async function rtDeleteByUserEmail(db: FastifyInstance['prisma'], email: string): Promise<Prisma.BatchPayload> {
  return db.refreshToken.deleteMany({
    where: {
      user: {
        email,
      },
    },
  });
};

export async function rtVerifyHash(db: FastifyInstance['prisma'], rtHash: string): Promise<RefreshToken | null> {
  return db.refreshToken.findFirst({
    where: {
      tokenHash: rtHash,
      revokedAt: null,
      expiresAt: {gt: new Date()},
    },
    include: {user: true},
  });
};

// access token
export function atGenerate(jwt: FastifyInstance['jwt'], payload: Object): string {
  return jwt.sign(payload, {expiresIn: '15m'});
};
