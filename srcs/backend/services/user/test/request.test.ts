import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

describe('Friend Request', () => {
  let app: FastifyInstance;
  const profileAId: string = 'request1';
  const profileBId: string = 'request2';
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
        username: 'test profile 1',
        email: 'test1@example.com',
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
        username: 'test profile 2',
        email: 'test2@example.com',
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

  it('POST /user/friend-request/:toProfileId - A befriend B - missing access token', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileBId}`,
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${at1}`,
      },
      payload: {
        message: 'hello',
      },
    });
    expect(r1.statusCode).toBe(401);
  });

  it('POST /user/friend-request/:toProfileId - A befriend B', async() => {
    const r1 = await app.inject({
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
    expect(r1.statusCode).toBe(200);
    expect(r1.json().request).toMatchObject({
      fromProfileId: profileAId,
      toProfileId: profileBId,
      status: 'PENDING',
      message: 'hello',
    });
  });

  it('POST /user/friend-request/:toProfileId - A befriend B - resend', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileBId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${at1}`,
      },
      payload: {
        message: 'hello2',
      },
    });
    expect(r1.statusCode).toBe(409);
  });

  it('GET /user/friend-request - list A friend requests', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/friend-request',
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().requests).toEqual([]);
  });

  it('GET /user/friend-request - list B friend requests', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/user/friend-request',
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().requests).toEqual([
      expect.objectContaining({
        fromProfileId: profileAId,
        toProfileId: profileBId,
        status: 'PENDING',
        message: 'hello'}
      )
    ]);
  });

  it('POST /user/friend-request/:fromProfileId/decline - A decline nonexistent', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/0/decline`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('POST /user/friend-request/:fromProfileId/accept - A accept nonexistent', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/0/accept`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('DELETE /user/friend-request/:fromProfileId - A cancel nonexistent', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend-request/0`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('POST /user/friend-request/:fromProfileId/decline - B decline A friend request', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileAId}/decline`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    // request deleted
    // expect(r1.json().request).toMatchObject({
    //   fromProfileId: profileAId,
    //   toProfileId: profileBId,
    //   status: 'PENDING',
    //   message: 'hello',
    // });
  });

  it('POST /user/friend-request/:toProfileId - A befriend B - resend', async() => {
    const r1 = await app.inject({
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
    expect(r1.statusCode).toBe(200);
  });

  it('DELETE /user/friend-request/:toProfileId - A cancel request to B', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend-request/${profileBId}`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(200);
  });

  it('POST /user/friend-request/:fromProfileId/accept - B accept A friend request', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileAId}/accept`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('POST /user/friend-request/:toProfileId - A befriend B - resend', async() => {
    const r1 = await app.inject({
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
    expect(r1.statusCode).toBe(200);
  });

  it('POST /user/friend-request/:fromProfileId/accept - B accept A friend request', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${profileAId}/accept`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    const body = r1.json();
    expect(body.request).toMatchObject({
      fromProfileId: profileAId,
      toProfileId: profileBId,
      status: 'ACCEPTED',
      message: 'hello',
    });
    expect(body.friendship).toMatchObject({
      profileAId: profileAId,
      profileBId: profileBId,
    });
  });
});
