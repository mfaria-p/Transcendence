import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import argon2 from 'argon2';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

const RT_COOKIE: string = 'refresh_token';

function extractCookies(raw: string | string[] | undefined): {[key: string]: string} {
  const setCookie = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return Object.fromEntries(
    setCookie.map((c: string) => {
      const [cookie] = c.split(';');
      const [key,value] = cookie!.split('=');
      return [key!.trim(), value!.trim()];
    })
  );
}

describe('Signup => Login => Me => Logout', () => {
  let app: FastifyInstance;
  let rt1: string = '';
  let rt2: string = '';
  let at: string = '';

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    try {
      await utils.accountDeleteByEmail(app.prisma, 'test@example.com')
    } catch(err) {}
  })

  afterAll(async () => {
    try {
      await utils.accountDeleteByEmail(app.prisma, 'test@example.com')
    } catch(err) {}
    await app.close();
  })

  it('POST /auth/signup - missing email', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {password: 'hello123'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/signup - missing password', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test@example.com'}
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/signup', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test@example.com', password: 'hello123'},
    });
    console.log(r1.json());
    expect(r1.statusCode).toBe(200);

    const newAccount = await app.prisma.account.findUnique({where: {email: 'test@example.com'}});
    expect(newAccount).toBeDefined();
    expect(newAccount!.email).toBe("test@example.com");
    expect(await argon2.verify(newAccount!.passwordHash!, "hello123")).toBe(true);
  })

  it('POST /auth/me - missing email', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/me',
      headers: {
        Authorization: `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/me - before login', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/me',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${at}`,
      },
      payload: {email: 'test@example.com'},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/login - missing email', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {password: 'hello123'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/login - missing password', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test@example.com'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/login - nonexisting email', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test2@example.com'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/login - invalid password', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test@example.com', password: 'hello1234'},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/login', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test@example.com', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(200);
    const cookies = extractCookies(r1.headers['set-cookie']);
    rt1 = cookies.refresh_token!;
    at = r1.json().at;
  })

  it('POST /auth/me - after login', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/me',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${at}`,
      },
      payload: {email: 'test@example.com'},
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toMatchObject({email: 'test@example.com'});
  })

  it('POST /auth/refresh - missing rt cookie', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/refresh - invalid rt cookie', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: {'refresh_token': 'banana'},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/refresh', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: {refresh_token: rt1},
    });
    expect(r1.statusCode).toBe(200);
    const cookies = extractCookies(r1.headers['set-cookie']);
    rt2 = cookies.refresh_token!;
  })

  it('POST /auth/logout - missing rt', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });
    expect(r1.statusCode).toBe(200);
  })

  it('POST /auth/logout - invalid rt cookie', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {'refresh_token': 'banana'},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/logout - old rt', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {'refresh_token': rt1},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/logout', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {'refresh_token': rt2},
    });
    expect(r1.statusCode).toBe(200);
  })
})
