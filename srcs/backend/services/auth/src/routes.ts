// src/routes.ts
// access + refresh tokens
// oauth2

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {Account, RefreshToken} from './generated/prisma/client.js';
import {randomBytes} from 'crypto';
import * as schemas from './schemas.js';
import * as utils from './utils.js';

const RT_COOKIE: string = 'refresh_token';

// TODO
// signed cookies
// jti for jwt id
// pepper for refreshToken
// best practice would be not delete refresh right away
// private public key for jwt
// remote auth
export default async function (app: FastifyInstance): Promise<void> {
  app.post('/signup', {schema: schemas.postSignupOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {username, email, password} = req.body as {username: string, email: string, password: string};

    const account = await utils.accountCreate(app.prisma, {username: username, email: email, passwordHash: await utils.pwHash(password)});

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
        username: username,
        email: email,
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
        username: account!.username,
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
    if (!account) return reply.code(401).send({message: 'Nonexisting account'});

    return account;
  });

  app.post('/me', {schema: schemas.postMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply) => {
    const {email} = req.body as {email: string};
    const account: Account | null = await utils.accountFindByEmail(app.prisma, email);
    if (!account) return reply.code(401).send({message: 'Nonexisting account'});

    return account;
  });

  app.get('/auth/google/login', {}, async (req: FastifyRequest, reply: FastifyReply) => {
    const state = randomBytes(16).toString('hex');
    const url = utils.googleBuildAuthUrl(state);

    // stateStore.set(state);

    return reply.redirect(url);
  });

  app.get('/auth/google/callback', {}, async (req: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = req.query as any;
    if (!code || !state) { //|| !stateStore.has(state)) {
      return reply.status(400).send({ error: 'invalid_state_or_missing_code' });
    }

    // stateStore.delete(state);

    const payload = await utils.googleGetPayload(code);
    if (!payload?.sub) {
      return reply.status(401).send({ error: 'invalid_google_payload' });
    }

    const at: String = utils.atGenerate(app.jwt, payload);

    return {
      success: true,
      message: 'Google Account Logged In',
      account: {
        id: `google:${payload!.sub}`,
        username: payload!.name,
        email: payload!.email,
        avatarUrl: payload!.picture,
      },
      at: at,
    };
  });
};
