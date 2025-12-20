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
// best practice would be not delete refresh right away
export default async function (app: FastifyInstance): Promise<void> {
  app.post('/signup', {schema: schemas.postSignupOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {username, email, password} = req.body as {username: string, email: string, password: string};

    const account = await utils.accountCreate(app.prisma, {username: username, email: email, passwordHash: await utils.pwHash(password)});

    return {
      success: true,
      message: 'Account Created Successfully',
      account: account,
    };
  });

  app.post('/login', {schema: schemas.postLoginOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {ident, password} = req.body as {ident: string, password: string};
    let account: Account | null = await utils.accountFindByEmail(app.prisma, ident);
    if (!account)
      account = await utils.accountFindByUsername(app.prisma, ident);
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
      account: account,
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

  app.put('/me', {schema: schemas.putMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const accountId: string = req.jwtPayload!.id;
    const {username, email} = req.body as {username: string, email: string};
    const account: Account | null = await utils.accountUpdate(app.prisma, accountId, {username: username, email: email});
    if (!account) return reply.code(401).send({success:false, message: 'Nonexisting account'});

    return {
      success: true,
      message: 'Account updated',
      account: account,
    }
  });

  app.put('/me/password', {schema: schemas.putMePasswordOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const accountId: string = req.jwtPayload!.id;
    const {currentPassword, newPassword} = req.body as {currentPassword: string, newPassword: string};

    let account : Account | null = await utils.accountFindById(app.prisma, accountId);
    const ok: Boolean = !!account && await utils.pwVerify(account.passwordHash!, currentPassword);
    if (!ok) return reply.code(401).send({success: false, message: 'Invalid Credentials'});

    account = await utils.accountUpdatePassword(app.prisma, accountId, await utils.pwHash(newPassword));
    if (!account) return reply.code(401).send({success:false, message: 'Nonexisting account'});

    return {
      success: true,
      message: 'Password updated',
      account: account,
    }
  });

  app.get('/me', {schema: schemas.getMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply) => {
    const accountId: string = req.jwtPayload!.id;
    const account: Account | null = await utils.accountFindById(app.prisma, accountId);
    if (!account) return reply.code(401).send({success: false, message: 'Nonexisting account'});

    return {
      success: true,
      message: 'Account info',
      account: account,
    };
  });

  app.delete('/me', {schema: schemas.deleteMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply: FastifyReply) => {
    const accountId: string = req.jwtPayload!.id;

    const account: Account = await utils.accountDeleteById(app.prisma, accountId);

    return {
      success: true,
      message: 'Account deleted',
      account: account,
    };
  });

  app.get('/', {schema: schemas.getAccountsOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const accounts: Account[] = await utils.accountFindAll(app.prisma);

    return {
      success: true,
      message: 'Public Accounts List',
      accounts: accounts,
    };
  });

  app.get('/:accountId', {schema: schemas.getAccountByIdOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {accountId} = req.params as {accountId: string};

    const account = await utils.accountFindById(app.prisma, accountId);
    if (!account) return reply.code(404).send({
      sucess: false,
      message: 'Nonexistent Account',
      account: null,
    });

    return {
      success: true,
      message: 'Public Account',
      account: account,
    };
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
    if (!payload?.sub || !payload?.email || !payload?.name) {
      return reply.status(401).send({success: false, message: 'Invalid google payload'});
    }

    let account: Account | null = await utils.accountFindByEmail(app.prisma, payload.email);
    let oauthAccount: OAuthAccount | null = await utils.oauthAccountFindByProviderAccountId(app.prisma, {sub: payload.sub, provider: OAuthProvider.google});
    if (account && !oauthAccount) {
      return reply.status(400).send({success: false, message: 'Email already taken'});
    }
    if (!account) {
      account = await utils.accountCreate(app.prisma, {username: payload.name, email: payload.email});
      oauthAccount = await utils.oauthAccountCreate(app.prisma, account.id, {sub: payload.sub, provider: OAuthProvider.google});
    }

    const at: String = utils.atGenerate(app.jwt, {sub: account.id});

    return {
      success: true,
      message: 'Google Account Logged In',
      account: {
        id: account.id,
        username: payload.name,
        email: payload.email,
        avatarUrl: payload.picture,
      },
      at: at,
    };
  });
};
