// src/routes.ts
// access + refresh tokens
// oauth2

import argon2 from 'argon2';
import {randomBytes, createHash} from 'crypto';

const getTestOpts = {
  schema: {
    summary: 'Test',
    description: 'Says hello to you :D',
    response: {
      200: {
        description: 'Test is successful',
        type: 'string',
      }
    }
  }
}

const postSignupOpts = {
  schema: {
    summary: 'Create user',
    description: '',
    body: {
      type: 'object',
      required: ['username','email', 'password'],
      properties: {
        username: {type: 'string'},
        email: {type: 'string'},
        password: {type: 'string'},
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          username: {type: 'string'},
          email: {type: 'string'},
          password: {type: 'string'},
        }
      }
    }
  }
}

const postLoginOpts = {
  schema: {
    summary: 'Login with email',
    description: '',
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {type: 'string'},
        password: {type: 'string'},
      }
    },
    response: {
      200: {
        type: 'string',
      }
    }
  }
}

const postRefreshOpts = {
  schema: {
    summary: 'Refresh session',
    descripton: `
      rotates refresh token
      returns JWT token
    `,
    cookie: {
      type: 'object',
      required: ['refresh_token'],
      properties: {
        refresh_token: {type: 'string'},
      }
    },
    response: {
      200: {
        type: 'string',
      }
    }
  }
}

// TODO
// signed cookies
// jti for jwt id
// pepper for refreshToken
// best practice would be not delete refresh right away
export default async function (auth, opts) {
  auth.get('/test', {getTestOpts, preHandler: [auth.authenticate]}, (req, reply) => "hello");

  auth.post('/signup', postSignupOpts, async (req, reply) => {
    const {username, email, password} = req.body as {username: String, email: String, password: String};
    const passwordHash = await argon2.hash(password);

    await auth.prisma.user.create({
      data: {
        'name': username,
        'email': email,
        'passwordHash': passwordHash},
    });

    return {ok: true};
  })

  auth.post('/login', postLoginOpts, async (req, reply) => {
    const {email, password} = req.body as {email: String, password: String};
    const user = await auth.prisma.user.findUnique({where: {email}});
    const ok = !!user && await argon2.verify(user.passwordHash, password);

    if (!ok) return reply.code(401).send({message: 'Invalid Credentials'});

    const accessToken = auth.jwt.sign({sub: user.id}, {expiresIn: '15m'});
    const refreshToken = randomBytes(32).toString('base64url');

    await auth.prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(refreshToken).digest('base64url'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
      }
    });

    try {
    reply
      .setCookie('refresh_token', refreshToken, {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
      })
      .send(accessToken);
    } catch(err) {
      console.log(err);
    }

    return {ok: true};
  })

  auth.post('/refresh', postRefreshOpts, async (req, reply) => {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) return reply.code(401).send({message: 'Missing refresh token'});

    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('base64url');
    const record = await auth.prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
        revoked: false,
        expiresAt: {gt: new Date()},
      },
      include: {user: true},
    });
    if (!record) return reply.code(401).send({message: 'Invalid or expired refresh token'});

    await auth.prisma.refreshToken.delete({
      where: {
        tokenHash: refreshTokenHash,
      },
    });
    const newRefreshToken = randomBytes(32).toString('base64url');
    await auth.prisma.refreshToken.create({
      data: {
        tokenHash: createHash('sha256').update(newRefreshToken).digest('base64url'),
        userId: record.userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
      }
    });

    const accessToken = auth.jwt.sign({sub: record.userId}, {expiresIn: '15m'});
    reply
      .setCookie('refresh_token', newRefreshToken, {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/refresh', maxAge: 30 * 24 * 60 * 60,
      })
      .send(accessToken);

    return {ok: true};
  })

  auth.post('/logout', async (req, reply) => {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      reply.clearCookie('refresh_token', {path: '/auth/refresh'});
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('base64url');
      const record = await auth.prisma.refreshToken.findFirst({
        where: {
          tokenHash: refreshTokenHash,
          revoked: false,
          expiresAt: {gt: new Date()},
        },
        include: {user: true},
      });
      if (!record) return reply.code(401).send({message: 'Invalid or expired refresh token'});
    }

    return {ok: true};
  })
}
