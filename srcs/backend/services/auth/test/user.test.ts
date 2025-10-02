import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import argon2 from 'argon2';
import {buildServer} from '../src/build';

describe('Signup', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  })

  afterAll(async () => {
    await app.close();
  })

  it('POST /auth/signup', async () => {
    try {
      await app.prisma.refreshToken.deleteMany({where: {user: {email: 'test@example.com'}}});
      await app.prisma.user.delete({where: {email: 'test@example.com'}});
    } catch(err) {
      console.log(err);
    }
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      header: {'content-type': 'application/json'},
      payload: {username: 'test user', email: 'test@example.com', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(200);

    const newUser = await app.prisma.user.findUnique({where: {email: 'test@example.com'}});
    expect(newUser.name).toBe("test user");
    expect(newUser.email).toBe("test@example.com");
    expect(await argon2.verify(newUser.passwordHash, "hello123")).toBe(true);

    let token: Object;
    const r2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      header: {'content-type': 'application/json'},
      payload: {email: 'test@example.com', password: 'hello123'},
    });
    expect(r2.statusCode).toBe(200);
    token = r2.body;

    const r3 = await app.inject({
      method: 'GET',
      url: '/auth/test',
      headers: {Authorization: `Bearer ${token}`},
    });
    expect(r3.statusCode).toBe(200);

    await app.prisma.refreshToken.deleteMany({where: {user: {email: 'test@example.com'}}});
    await app.prisma.user.delete({where: {email: 'test@example.com'}});
  })
})
