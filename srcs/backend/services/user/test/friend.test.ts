import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

describe('Friendship', () => {
  let app: FastifyInstance;
  const userAId: string = 'friend1';
  const userBId: string = 'friend2';
  let at1: string = '';
  let at2: string = '';

  beforeAll(async () => {
    app = await buildServer();

    try {
      await app.prisma.$executeRaw`DELETE FROM Profile;`;
      await app.prisma.$executeRaw`DELETE FROM FriendRequest;`;
      await app.prisma.$executeRaw`DELETE FROM Friendship;`;
    } catch(err) {}

    at1 = app.jwt.sign({sub: userAId}, {expiresIn: '15m'});
    await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at1}`,
      },
      payload: {
        username: 'test user 1',
        email: 'test1@example.com',
      },
    });

    at2 = app.jwt.sign({sub: userBId}, {expiresIn: '15m'});
    await app.inject({
      method: 'PUT',
      url: '/user/provision',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at2}`,
      },
      payload: {
        username: 'test user 2',
        email: 'test2@example.com',
      },
    });

    await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userBId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at1}`,
      },
      payload: {
        message: 'hello',
      },
    });

    await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userAId}/accept`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });

    await app.ready();
  });

  afterAll(async () => {
    try {
      await app.prisma.$executeRaw`DELETE FROM Friendship;`;
    } catch (err) {}
    try {
      await app.prisma.$executeRaw`DELETE FROM FriendRequest;`;
    } catch (err) {}
    try {
      await app.prisma.$executeRaw`DELETE FROM Profile;`;
    } catch (err) {}
    await app.close();
  });

  it('GET /user/friend/:userId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${userAId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({userAId: userAId, userBId: userBId})
      ])
    );
  });

  it('GET /user/friend/:userId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${userBId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({userAId: userAId, userBId: userBId})
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
        expect.objectContaining({userAId: userAId, userBId: userBId})
      ])
    );
  });

  it('DELETE /user/friend/:userid - Unfriend A and B', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend/${userAId}`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
  });

  it('GET /user/friend/:userId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${userAId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({userAId: userAId, userBId: userBId})
      ])
    );
  });

  it('GET /user/friend/:userId - List A public friends', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/user/friend/${userBId}`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().friendships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({userAId: userAId, userBId: userBId})
      ])
    );
  });

  it('DELETE /user/friend/:userid - Unfriend A and B', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend/${userAId}`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });
});
