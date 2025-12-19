// src/utils.ts

import type {FastifyInstance} from 'fastify';
import type {Account, RefreshToken, OAuthAccount} from './generated/prisma/client.js';
import {Prisma, OAuthProvider} from './generated/prisma/client.js';
import createError from '@fastify/error';
import { OAuth2Client } from 'google-auth-library';
import * as argon from 'argon2';
import {randomBytes, createHash} from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const AlreadyExistsError = createError('ALREADY_EXISTS', 'Duplicate record', 409);
const InvalidRelationError = createError('INVALID_RELATION', 'Invalid reference', 400);
const NotFoundError = createError('NOT_FOUND', 'Record not found', 404);
const DatabaseError = createError('DB_ERROR', 'Database error', 500);

function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const fields = error.meta?.target ?? [];
    switch (error.code) {
      case 'P2002':
        const fields = (error.meta?.target as string[]) || [];
        const fieldList = fields.join(', ') || 'unknown field';
        throw new AlreadyExistsError(`${fieldList} already exists`);
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

// account
export async function accountCreate(db: FastifyInstance['prisma'], account: {username: string, email: string, passwordHash?: string}): Promise<Account> {
  try {
    return await db.account.create({
      data: account
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function accountDeleteByEmail(db: FastifyInstance['prisma'], email: string): Promise<Account> {
  try {
    return await db.account.delete({
      where: {
        email,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function accountFindById(db: FastifyInstance['prisma'], accountId: string): Promise<Account | null> {
  try {
    return await db.account.findUnique({
      where: {
        id: accountId,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function accountFindByEmail(db: FastifyInstance['prisma'], email: string): Promise<Account | null> {
  try {
    return await db.account.findUnique({
      where: {
        email,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function accountFindByUsername(db: FastifyInstance['prisma'], username: string): Promise<Account | null> {
  try {
    return await db.account.findUnique({
      where: {
        username,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function accountUpdate(db: FastifyInstance['prisma'], id: string, account: {username?: string, email?: string}): Promise<Account | null> {
  const data = {
    ...(account.username && {username: account.username}),
    ...(account.email && {email: account.email}),
  };
  try {
    return await db.account.update({
      where: {
        id,
      },
      data: data
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function accountUpdatePassword(db: FastifyInstance['prisma'], id: string, pwHash: string): Promise<Account | null> {
  try {
    return await db.account.update({
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

// oauthaccount
export async function oauthAccountCreate(db: FastifyInstance['prisma'], accountId: string, oauthAccount: {sub: string, provider: OAuthProvider}): Promise<OAuthAccount> {
  try {
    return await db.oAuthAccount.create({
      data: {
        provider: oauthAccount.provider,
        providerAccountId: oauthAccount.sub,
        accountId: accountId,
      }
    });
  } catch(err) {
    handlePrismaError(err);
  };
}

export async function accountDeleteById(db: FastifyInstance['prisma'], id: string): Promise<Account> {
  try {
    return await db.account.delete({
      where: {
        id,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

// OAuthAccount

export async function oauthAccountFindByAccountId(db: FastifyInstance['prisma'], accountId: string): Promise<OAuthAccount | null> {
  try {
    return await db.oAuthAccount.findUnique({
      where: {
        accountId,
      },
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

export async function oauthAccountFindByProviderAccountId(db: FastifyInstance['prisma'], oauthAccount: {sub: string, provider: OAuthProvider}): Promise<OAuthAccount | null> {
  try {
    return await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: oauthAccount.provider,
          providerAccountId: oauthAccount.sub,
        }
      },
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

export async function rtCreate(db: FastifyInstance['prisma'], rt: string, accountId: string): Promise<RefreshToken> {
  try {
    return await db.refreshToken.create({
      data: {
        tokenHash: rtHash(rt),
        accountId: accountId,
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

export async function rtDeleteByAccountEmail(db: FastifyInstance['prisma'], email: string): Promise<Prisma.BatchPayload> {
  try {
    return await db.refreshToken.deleteMany({
      where: {
        account: {
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
      include: {account: true},
    });
  } catch(err) {
    handlePrismaError(err);
  };
};

// access token
export function atGenerate(jwt: FastifyInstance['jwt'], payload: Object): string {
  return jwt.sign(payload, {expiresIn: '15m'});
};

// google remote login

export function googleBuildAuthUrl(state: string, code_challenge: string | null = null): string  {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state
  })
  if (code_challenge) params.set('code_challenge', code_challenge);
  if (code_challenge) params.set('code_challenge_method', 'S256');
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GooglePayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

const CLIENT_ID: string = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const CLIENT_SECRET: string = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
const REDIRECT_URI: string = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:9000/api/auth/google/callback';

const googleClient = new OAuth2Client(CLIENT_ID);

export async function googleGetPayload(code: string): Promise<GooglePayload | undefined> {

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  interface TokenResponse {
    access_token: string;
    id_token: string;
    refresh_token?: string;
    error?: string;
  }
  const tokenJson = (await tokenRes.json()) as TokenResponse;
  if (tokenJson.error || !tokenJson.id_token) {
    throw new (createError('TOKEN_EXCHANGE_FAILED', 'google token exchange failed', 500))();
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokenJson.id_token,
    audience: CLIENT_ID
  });

  return ticket.getPayload();
}
