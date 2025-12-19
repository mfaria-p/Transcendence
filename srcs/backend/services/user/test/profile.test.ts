import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

describe('Profile', () => {
  let app: FastifyInstance;
  const profileId: string = 'profile1';
  let at: string = '';

  beforeAll(async () => {
    app = await buildServer();
    at = app.jwt.sign({sub: profileId}, {expiresIn: '15m'});
    try {
      await app.prisma.profile.deleteMany();
    } catch (err) {}
    await app.ready();
  });

  afterAll(async () => {
    try {
      await app.prisma.profile.deleteMany();
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
        // 'Authorization': `Bearer ${at}`,
      },
      payload: {
        // avatarUrl: 'a',
      },
    });
    expect(r1.statusCode).toBe(401);
  });

  it('PUT /user/provision - invalid access token', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Authorization': 'Bearer banana',
      },
      payload: {
        // avatarUrl: 'a',
      },
    });
    expect(r1.statusCode).toBe(401);
  });

  it('PUT /user/provision', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
      payload: {
        // avatarUrl: 'a',
      },
    });
    console.log(r1.json());
    expect(r1.statusCode).toBe(200);
  });

  it('GET /user/', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/',
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profiles).toEqual([{id: profileId, avatarUrl: ''}]);
  });

  it('GET /user/:profileid', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/${profileId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profile).toMatchObject({id: profileId, avatarUrl: ''});
  });

  it('PUT /user/provision - update avatar', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
      payload: {
        avatarUrl: 'picture',
      },
    });
    console.log(r1.json());
    expect(r1.statusCode).toBe(200);
  });

  it('GET /user/:profileid', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/${profileId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().profile).toMatchObject({id: profileId, avatarUrl: 'picture'});
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
    expect(r1.json().profile).toMatchObject({id: profileId});
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
    expect(r1.json().profile).toMatchObject({id: profileId});
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

  it('PUT /user/provision', async() => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
      payload: {
        avatarUrl: 'picture2',
      },
    });
    console.log(r1.json());
    expect(r1.statusCode).toBe(200);
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
    expect(r1.json().profile).toMatchObject({id: profileId, avatarUrl: 'picture2'});
  });
});
