import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

describe.sequential('Profile', () => {
  let app: FastifyInstance;
  const userId: string = 'profile1';
  let at: string = '';

  beforeAll(async () => {
    app = await buildServer();
    at = app.jwt.sign({sub: userId}, {expiresIn: '15m'});
    try {
      app.prisma.profile.delete({where: {id: userId}});
    } catch (err) {}
    await app.ready();
  });

  afterAll(async () => {
    try {
      app.prisma.profile.delete({where: {id: userId}});
    } catch (err) {}
    await app.close();
  });

  it('GET /user/', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/',
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profiles).toEqual([]);
  });

  it('PUT /user/provision - missing access token', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${at}`,
      },
      payload: {
        username: 'test user 1',
        email: 'test1@example.com',
      },
    });
    expect(r1.statusCode).toBe(401);
  });

  it('PUT /user/provision - missing username', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at}`,
      },
      payload: {
        // username: 'test user 1',
        email: 'test1@example.com',
      },
    });
    expect(r1.statusCode).toBe(400);
  });

  it('PUT /user/provision - missing email', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at}`,
      },
      payload: {
        username: 'test user 1',
        // email: 'test1@example.com',
      },
    });
    expect(r1.statusCode).toBe(400);
  });

  it('PUT /user/provision', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at}`,
      },
      payload: {
        username: 'test user 1',
        email: 'test1@example.com',
      },
    });
    expect(r1.statusCode).toBe(200);
  });

  it('GET /user/', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/',
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profiles).toEqual([{id: userId, email: 'test1@example.com', name: 'test user 1', avatarUrl: ''}]);
  });

  it('GET /user/:userid', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/${userId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profile).toMatchObject({id: userId, email: 'test1@example.com'});
  });

  it('GET /user/2', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/2',
    });
    expect(r1.statusCode).toBe(404);
  });

  it('GET /user/me - missing access token', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/me',
    });
    expect(r1.statusCode).toBe(401);
  });

  it('GET /user/me', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/me',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profile).toMatchObject({id: userId});
  });

  it('DELETE /user/me - missing access token', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: '/user/me',
      headers: {
        // 'Authorization': `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(401);
  });

  it('DELETE /user/me', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: '/user/me',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profile).toMatchObject({id: userId});
  });

  it('GET /user/1', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/1',
    });
    expect(r1.statusCode).toBe(404);
  });

  it('GET /user/me', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/me',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });
});
