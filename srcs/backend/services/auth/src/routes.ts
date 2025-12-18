// src/routes.ts
// access + refresh tokens
// oauth2

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {Account, RefreshToken, OAuthAccount} from './generated/prisma/client.js';
import {OAuthProvider} from './generated/prisma/client.js';
import {randomBytes} from 'crypto';
import * as schemas from './schemas.js';
import * as utils from './utils.js';

const RT_COOKIE: string = 'refresh_token';

// TODO
// signed cookies
// salt for refreshToken
// best practice would be not delete refresh right away
export default async function (app: FastifyInstance): Promise<void> {
  app.post('/signup', {schema: schemas.postSignupOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {email, password} = req.body as {email: string, password: string};

    const account = await utils.accountCreate(app.prisma, {email: email, passwordHash: await utils.pwHash(password)});

    // Auto-login after signup
    const at: string = utils.atGenerate(app.jwt, {sub: account.id});
    const rt: string = utils.rtGenerate();
    await utils.rtCreate(app.prisma, rt, account.id);

    reply.setCookie(RT_COOKIE, rt, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: 'Account Created Successfully',
      account: {
        id: account.id,
        email: account.email,
      },
      at: at,
    };
  });

  app.post('/login', {schema: schemas.postLoginOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {email, password} = req.body as {email: string, password: string};
    const account: Account | null = await app.prisma.account.findUnique({where: {email}});
    const ok: Boolean = !!account && await utils.pwVerify(account.passwordHash!, password);

    if (!ok) return reply.code(401).send({
      success: false,
      message: 'Invalid Credentials',
    });

    const at: string = utils.atGenerate(app.jwt, {sub: account!.id});
    const rt: string = utils.rtGenerate();
    await utils.rtCreate(app.prisma, rt, account!.id);

    reply.setCookie(RT_COOKIE, rt, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: 'Account Logged In',
      account: {
        id: account!.id,
        email: account!.email,
      },
      at: at,
    };
  });

  app.post('/refresh', {schema: schemas.postRefreshOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const rt: string | undefined = req.cookies[RT_COOKIE];
    if (!rt) return reply.code(401).send({
      sucess: false,
      message: 'Missing refresh token',
    });

    const rtHash: string = utils.rtHash(rt);
    const rtRecord: RefreshToken | null = await utils.rtVerifyHash(app.prisma, rtHash);
    // const records = await app.prisma.refreshToken.findMany();
    if (!rtRecord) return reply.code(401).send({
      success: false,
      message: 'Invalid or expired refresh token',
    });

    await utils.rtDeleteByHash(app.prisma, rtHash);
    const rtNew: string = utils.rtGenerate();
    await utils.rtCreate(app.prisma, rtNew, rtRecord.accountId);
    const at: string = utils.atGenerate(app.jwt, {sub: rtRecord.accountId});

    reply.setCookie(RT_COOKIE, rtNew, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: 'Session Refreshed',
      at: at,
    };
  });

  app.post('/logout', {schema: schemas.postLogoutOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const rt: string | undefined = req.cookies[RT_COOKIE];
    if (rt) {
      reply.clearCookie(RT_COOKIE, {path: '/auth/refresh'});
      const rtRecord: RefreshToken | null = await utils.rtVerifyHash(app.prisma, utils.rtHash(rt));
      if (!rtRecord) return reply.code(401).send({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    };

    return {
      success: true,
      message: 'Account Logged Out',
    };
  });

  app.put('/me/password', {schema: schemas.postMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const accountId: string = req.jwtPayload!.id;
    const {pw} = req.body as {pw: string};
    const account: Account | null = await utils.accountUpdatePassword(app.prisma, accountId, await utils.pwHash(pw));
    if (!account) return reply.code(401).send({success:false, message: 'Nonexisting account'});

    return account;
  });

  app.post('/me', {schema: schemas.postMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply) => {
    const {email} = req.body as {email: string};
    const account: Account | null = await utils.accountFindByEmail(app.prisma, email);
    if (!account) return reply.code(401).send({success: false, message: 'Nonexisting account'});

    return account;
  });

  app.get('/google/login', {}, async (req: FastifyRequest, reply: FastifyReply) => {
    const state = randomBytes(16).toString('hex');
    const url = utils.googleBuildAuthUrl(state);

    // stateStore.set(state);

    return reply.redirect(url);
  });

  app.get('/google/callback', {}, async (req: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = req.query as any;
    if (!code || !state) { //|| !stateStore.has(state)) {
      return reply.status(400).send({success: false, message: 'Invalid state or missing code'});
    }

    // stateStore.delete(state);

    const payload = await utils.googleGetPayload(code);
    if (!payload?.sub || !payload?.email) {
      return reply.status(401).send({success: false, message: 'Invalid google payload'});
    }

    let account: Account | null = await utils.accountFindByEmail(app.prisma, payload.email);
    let oauthAccount: OAuthAccount | null = await utils.oauthAccountFindByProviderAccountId(app.prisma, {sub: payload.sub, provider: OAuthProvider.google});
    if (account && !oauthAccount) {
      return reply.status(400).send({success: false, message: 'Email already taken'});
    }
    if (!account) {
      account = await utils.accountCreate(app.prisma, {email: payload.email});
      oauthAccount = await utils.oauthAccountCreate(app.prisma, account.id, {sub: payload.sub, provider: OAuthProvider.google});
    }

    const at: String = utils.atGenerate(app.jwt, {sub: account.id});

    return {
      success: true,
      message: 'Google Account Logged In',
      account: {
        id: account.id,
        email: payload.email,
        username: payload.name,
        avatarUrl: payload.picture,
      },
      at: at,
    };
  });
};
