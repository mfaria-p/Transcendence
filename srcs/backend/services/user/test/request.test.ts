import type {FastifyInstance} from 'fastify';
import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {buildServer} from '../src/build.js';
import * as utils from '../src/utils.js'

describe.sequential('Friend Request', () => {
  let app: FastifyInstance;
  const userAId: string = 'request1';
  const userBId: string = 'request2';
  let at1: string = '';
  let at2: string = '';

  beforeAll(async () => {
    app = await buildServer();

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

    try {
      await app.prisma.friendRequest.delete({where: {fromUserId_toUserId: {fromUserId: userAId, toUserId: userBId}}});
    } catch (err) {}
    try {
      await app.prisma.friendship.delete({where: {userAId_userBId: {userAId: userAId, userBId: userBId}}});
    } catch (err) {}

    await app.ready();
  });

  afterAll(async () => {
    try {
      await app.prisma.friendship.delete({where: {userAId_userBId: {userAId: userAId, userBId: userBId}}});
    } catch (err) {}
    try {
      await app.prisma.friendRequest.delete({where: {fromUserId_toUserId: {fromUserId: userAId, toUserId: userBId}}});
    } catch (err) {}
    try {
      app.prisma.profile.delete({where: {id: userAId}});
    } catch (err) {}
    try {
      app.prisma.profile.delete({where: {id: userBId}});
    } catch (err) {}
    await app.close();
  });

  it('POST /user/friend-request/:toUserId - A befriend B - missing access token', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userBId}`,
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

  it('POST /user/friend-request/:toUserId - A befriend B', async() => {
    const r1 = await app.inject({
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
    expect(r1.statusCode).toBe(200);
    expect(r1.json().request).toMatchObject({
      fromUserId: userAId,
      toUserId: userBId,
      status: 'PENDING',
      message: 'hello',
    });
  });

  it('POST /user/friend-request/:toUserId - A befriend B - resend', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userBId}`,
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
        fromUserId: userAId,
        toUserId: userBId,
        status: 'PENDING',
        message: 'hello'}
      )
    ]);
  });

  it('POST /user/friend-request/:fromUserId/decline - A decline nonexistent', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/0/decline`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('POST /user/friend-request/:fromUserId/accept - A accept nonexistent', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/0/accept`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('DELETE /user/friend-request/:fromUserId - A cancel nonexistent', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend-request/0`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('POST /user/friend-request/:fromUserId/decline - B decline A friend request', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userAId}/decline`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    // request deleted
    // expect(r1.json().request).toMatchObject({
    //   fromUserId: userAId,
    //   toUserId: userBId,
    //   status: 'PENDING',
    //   message: 'hello',
    // });
  });

  it('POST /user/friend-request/:toUserId - A befriend B - resend', async() => {
    const r1 = await app.inject({
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
    expect(r1.statusCode).toBe(200);
  });

  it('DELETE /user/friend-request/:toUserId - A cancel request to B', async() => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: `/user/friend-request/${userBId}`,
      headers: {
        'Authorization': `Bearer ${at1}`,
      },
    });
    expect(r1.statusCode).toBe(200);
  });

  it('POST /user/friend-request/:fromUserId/accept - B accept A friend request', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userAId}/accept`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(404);
  });

  it('POST /user/friend-request/:toUserId - A befriend B - resend', async() => {
    const r1 = await app.inject({
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
    expect(r1.statusCode).toBe(200);
  });

  it('POST /user/friend-request/:fromUserId/accept - B accept A friend request', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: `/user/friend-request/${userAId}/accept`,
      headers: {
        'Authorization': `Bearer ${at2}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    const body = r1.json();
    expect(body.request).toMatchObject({
      fromUserId: userAId,
      toUserId: userBId,
      status: 'ACCEPTED',
      message: 'hello',
    });
    expect(body.friendship).toMatchObject({
      userAId: userAId,
      userBId: userBId,
    });
  });
});
