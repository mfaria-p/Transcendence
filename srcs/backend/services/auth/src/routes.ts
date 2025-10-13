// src/routes.ts
// access + refresh tokens
// oauth2

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {User, RefreshToken} from './generated/prisma/client.js';
import * as schemas from './schemas.js';
import * as token from './token.js';

const RT_COOKIE: string = 'refresh_token';

// TODO
// signed cookies
// jti for jwt id
// pepper for refreshToken
// best practice would be not delete refresh right away
// private public key for jwt
export default async function (auth: FastifyInstance): Promise<void> {
  auth.post('/signup', {schema: schemas.postSignupOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {username, email, password} = req.body as {username: string, email: string, password: string};

    await token.userCreate(auth.prisma, {name: username, email: email, passwordHash: await token.pwHash(password)});

    return {ok: true};
  })

  auth.post('/login', {schema: schemas.postLoginOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const {email, password} = req.body as {email: string, password: string};
    const user: User | null = await auth.prisma.user.findUnique({where: {email}});
    const ok: Boolean = !!user && await token.pwVerify(user.passwordHash!, password);

    if (!ok) return reply.code(401).send({message: 'Invalid Credentials'});

    const at: string = token.atGenerate(auth.jwt, {sub: user!.id});
    const rt: string = token.rtGenerate();
    await token.rtCreate(auth.prisma, rt, user!.id);

    reply
      .setCookie(RT_COOKIE, rt, {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
      })
      .send(at);

    return {ok: true};
  })

  auth.post('/refresh', {schema: schemas.postRefreshOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const rt: string | undefined = req.cookies[RT_COOKIE];
    if (!rt) return reply.code(401).send({message: 'Missing refresh token'});

    const rtHash: string = token.rtHash(rt);
    const rtRecord: RefreshToken | null = await token.rtVerifyHash(auth.prisma, rtHash);
    const records = await auth.prisma.refreshToken.findMany();
    if (!rtRecord) return reply.code(401).send({message: 'Invalid or expired refresh token', rt: rt, hash: rtHash, records: records});

    await token.rtDeleteByHash(auth.prisma, rtHash);
    const rtNew: string = token.rtGenerate();
    await token.rtCreate(auth.prisma, rtNew, rtRecord.userId);
    const at: string = token.atGenerate(auth.jwt, {sub: rtRecord.userId});

    reply
      .setCookie(RT_COOKIE, rtNew, {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
      })
      .send(at);

    return {ok: true};
  })

  auth.post('/logout', {schema: schemas.postLogoutOpts}, async (req: FastifyRequest, reply: FastifyReply) => {
    const rt: string | undefined = req.cookies[RT_COOKIE];
    if (rt) {
      reply.clearCookie(RT_COOKIE, {path: '/auth/refresh'});
      const rtRecord: RefreshToken | null = await token.rtVerifyHash(auth.prisma, token.rtHash(rt));
      if (!rtRecord) return reply.code(401).send({message: 'Invalid or expired refresh token'});
    }

    return {ok: true};
  })

  auth.post('/me', {schema: schemas.postMeOpts, preHandler: [auth.authenticate]}, async (req: FastifyRequest, reply) => {
    const {email} = req.body as {email: string};
    const user: User | null = await token.userFindByEmail(auth.prisma, email);
    if (!user) return reply.code(401).send({message: 'Nonexisting user'});

    return user;
  });

}
