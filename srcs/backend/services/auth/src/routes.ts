// src/routes.ts
// access + refresh tokens
// oauth2

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {User, RefreshToken} from './generated/prisma/client.js';
import * as schemas from './schemas.js';
import * as utils from './utils.js';

const RT_COOKIE: string = 'refresh_token';

// TODO
// signed cookies
// jti for jwt id
// pepper for refreshToken
// best practice would be not delete refresh right away
// private public key for jwt
export default async function (app: FastifyInstance): Promise<void> {
  app.post('/signup', {schema: schemas.postSignupOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {username, email, password} = req.body as {username: string, email: string, password: string};

    const user = await utils.userCreate(app.prisma, {name: username, email: email, passwordHash: await utils.pwHash(password)});

    // Auto-login after signup
    const at: string = utils.atGenerate(app.jwt, {sub: user.id});
    const rt: string = utils.rtGenerate();
    await utils.rtCreate(app.prisma, rt, user.id);

    reply.setCookie(RT_COOKIE, rt, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: "Account Created Successfully",
      user: {
        id: user.id,
        username: username,
        email: email,
      },
      at: at,
    };
  });

  app.post('/login', {schema: schemas.postLoginOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {email, password} = req.body as {email: string, password: string};
    const user: User | null = await app.prisma.user.findUnique({where: {email}});
    const ok: Boolean = !!user && await utils.pwVerify(user.passwordHash!, password);

    if (!ok) return reply.code(401).send({
      success: false,
      message: 'Invalid Credentials',
    });

    const at: string = utils.atGenerate(app.jwt, {sub: user!.id});
    const rt: string = utils.rtGenerate();
    await utils.rtCreate(app.prisma, rt, user!.id);

    reply.setCookie(RT_COOKIE, rt, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: "User Logged In",
      user: {
        id: user!.id,
        username: user!.name,
        email: user!.email,
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
    await utils.rtCreate(app.prisma, rtNew, rtRecord.userId);
    const at: string = utils.atGenerate(app.jwt, {sub: rtRecord.userId});

    reply.setCookie(RT_COOKIE, rtNew, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
    });

    return {
      success: true,
      message: "Session Refreshed",
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
      message: "User Logged Out",
    };
  });

  app.put('/me/password', {schema: schemas.postMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply) => {
    const userId: string = req.jwtPayload!.id;
    const {pw} = req.body as {pw: string};
    const user: User | null = await utils.userUpdatePassword(app.prisma, userId, await utils.pwHash(pw));
    if (!user) return reply.code(401).send({message: 'Nonexisting user'});

    return user;
  });

  app.post('/me', {schema: schemas.postMeOpts, preHandler: [app.authenticate]}, async (req: FastifyRequest, reply) => {
    const {email} = req.body as {email: string};
    const user: User | null = await utils.userFindByEmail(app.prisma, email);
    if (!user) return reply.code(401).send({message: 'Nonexisting user'});

    return user;
  });
};
