// src/routes.ts
// access + refresh tokens
// oauth2

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {Account, RefreshToken, OAuthAccount} from '@prisma/client';
import {OAuthProvider} from '@prisma/client';
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
    let account: Account | null = await utils.accountFindByEmail(app.prisma, ident) || await utils.accountFindByUsername(app.prisma, ident);
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
    const oauthAccount: OAuthAccount | null = await utils.oauthAccountFindByAccountId(app.prisma, accountId);
    const isOAuth = (!oauthAccount) ? false : true;

    return {
      success: true,
      message: 'Account info',
      account: account,
      isOAuthAccount: isOAuth,
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

  app.get('/:id', {schema: schemas.getAccountByIdOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {id} = req.params as {id: string};

    const account = await utils.accountFindById(app.prisma, id);
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

  app.get('/search', {schema: schemas.getAccountsByIdentPrefixOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {prefix} = req.query as {prefix: string};

    const accounts = await utils.accountFindByIdentPrefix(app.prisma, prefix);
    return {
      success: true,
      message: 'Public Account',
      accounts: accounts,
    };
  });

  app.get('/google/login', {}, async (req: FastifyRequest, reply: FastifyReply) => {
    const state = randomBytes(16).toString('hex');
    const url = utils.googleBuildAuthUrl(state);

    // stateStore.set(state);

    return reply.redirect(url);
  });

app.get('/google/callback', {}, async (req: FastifyRequest, reply: FastifyReply) => {
  const { code, state, error } = req.query as any;
  
  // User cancelled the authentication
  if (error === 'access_denied') {
    return reply.redirect(`/login.html`);
  }
  
  // Missing required parameters (actual error)
  if (!code || !state) {
    return reply.redirect(`/google-callback.html?error=${encodeURIComponent('Invalid authentication request')}`);
  }

  try {
    const payload = await utils.googleGetPayload(code);
    if (!payload?.sub || !payload?.email || !payload?.name) {
      return reply.redirect(`/google-callback.html?error=${encodeURIComponent('Invalid Google account data')}`);
    }

    let account: Account | null = await utils.accountFindByEmail(app.prisma, payload.email);
    let oauthAccount: OAuthAccount | null = await utils.oauthAccountFindByProviderAccountId(app.prisma, {sub: payload.sub, provider: OAuthProvider.google});
    if (account && !oauthAccount) {
      return reply.redirect(`/google-callback.html?error=${encodeURIComponent('Email already registered with a different login method')}`);
    }    
    if (!account) {
      let username = payload.name
        .replace(/[^a-zA-Z0-9_]/g, '_')  // Remove invalid characters
        .substring(0, 20);                 // Max 20 chars
      
      if (username.length < 3) {
        username = `user_${username}`;
      }
      
      let finalUsername = username;
      let counter = 1;
      while (await utils.accountFindByUsername(app.prisma, finalUsername)) {
        finalUsername = `${username.substring(0, 17)}_${counter}`;
        counter++;
      }
      account = await utils.accountCreate(app.prisma, {username: finalUsername, email: payload.email});
      oauthAccount = await utils.oauthAccountCreate(app.prisma, account.id, {sub: payload.sub, provider: OAuthProvider.google});
    }

    const at: String = utils.atGenerate(app.jwt, {sub: account.id});

    const accountData = encodeURIComponent(JSON.stringify({
        id: account.id,
        username: account.username,
        email: account.email,
        avatarUrl: payload.picture || '',
      }));

    return reply.redirect(`/google-callback.html?at=${at}&account=${accountData}`);
  } catch (error: any) {
    app.log.error({ err: error }, 'Google OAuth callback error');
    return reply.redirect(`/google-callback.html?error=${encodeURIComponent(error.message || 'Google authentication failed')}`);
  }
});
};
