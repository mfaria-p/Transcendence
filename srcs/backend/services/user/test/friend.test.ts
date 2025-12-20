import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

describe('Friendship', () => {
  let app: FastifyInstance;
  const profileAId: string = 'friend1';
  const profileBId: string = 'friend2';
  let at1: string = '';
  let at2: string = '';

  beforeAll(async () => {
    app = await buildServer();

    try {
      await app.prisma.profile.deleteMany();
    } catch(err) {}

    at1 = app.jwt.sign({sub: profileAId}, {expiresIn: '15m'});
    await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at1}`,
      },
      payload: {
      },
    });

    at2 = app.jwt.sign({sub: profileBId}, {expiresIn: '15m'});
    await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at2}`,
      },
      payload: {
      },
    });

    await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileBId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at1}`,
      },
      payload: {
        message: 'hello',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileAId}/accept`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });

    await app.ready();
  });

  afterAll(async () => {
    try {
      await app.prisma.profile.deleteMany();
    } catch (err) {}
    await app.close();
  });

  it('GET /user/friend/:profileId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${profileAId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({profileAId: profileAId, profileBId: profileBId})
      ])
    );
  });

  it('GET /user/friend/:profileId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${profileBId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({profileAId: profileAId, profileBId: profileBId})
      ])
    );
  });

  it('GET /user/friend - List Logged In A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/friend',
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({profileAId: profileAId, profileBId: profileBId})
      ])
    );
  });

  it('DELETE /user/friend/:profileid - Unfriend A and B', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend/${profileAId}`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
  });

  it('GET /user/friend/:profileId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${profileAId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({profileAId: profileAId, profileBId: profileBId})
      ])
    );
  });

  it('GET /user/friend/:profileId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${profileBId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({profileAId: profileAId, profileBId: profileBId})
      ])
    );
  });

  it('DELETE /user/friend/:profileid - Unfriend A and B', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend/${profileAId}`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });
});
