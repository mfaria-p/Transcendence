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
  let at2: string = '';
  let accountId: string = '';

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    try {
      await app.prisma.account.deleteMany();
    } catch(err) {}
  })

  afterAll(async () => {
    try {
      await app.prisma.account.deleteMany();
    } catch(err) {}
    await app.close();
  })

  it('GET /auth/', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/',
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().accounts).toEqual([]);
  });

  it('POST /auth/signup - missing email', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {username: 'test1', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/signup - missing username', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {email: 'test@example.com', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/signup - missing password', async() => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {username: 'test1', email: 'test@example.com'}
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/signup', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {username: 'test1', email: 'test@example.com', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(200);
    const account = r1.json().account;
    accountId = account.id;

    expect(account).toMatchObject({username: "test1", email: "test@example.com"})
    expect(account).not.toHaveProperty("passwordHash");

    const newAccount = await app.prisma.account.findUnique({where: {email: 'test@example.com'}});
    expect(newAccount).toBeDefined();
    expect(await argon2.verify(newAccount!.passwordHash!, "hello123")).toBe(true);
  })

  it('GET /auth/', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/',
    });
    expect(r1.statusCode).toBe(200);
    const accounts = r1.json().accounts;
    expect(accounts).toEqual([{id: accountId, username: 'test1', email: 'test@example.com'}]);
    expect(accounts.every(o => !("passwordHash" in o))).toBe(true)
  });

  it('GET /auth/:accountid', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/auth/${accountId}`,
    });
    expect(r1.statusCode).toBe(200);
    const account = r1.json().account;
    expect(account).toMatchObject({id: accountId, username: 'test1', email: 'test@example.com'});
    expect(account).not.toHaveProperty("passwordHash");
  });

  it('GET /auth/search?', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/search?',
    });
    expect(r1.statusCode).toBe(400);
  });

  it('GET /auth/search?prefix=a', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/search?prefix=a',
    });
    expect(r1.statusCode).toBe(200);
    const accounts = r1.json().accounts;
    expect(accounts).toEqual([]);
  });

  it('GET /auth/search?prefix=t', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/search?prefix=t',
    });
    expect(r1.statusCode).toBe(200);
    const accounts = r1.json().accounts;
    expect(accounts).toEqual([{id: accountId, username: 'test1', email: 'test@example.com'}]);
    expect(accounts.every(o => !("passwordHash" in o))).toBe(true)
  });

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
      payload: {ident: 'test@example.com'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/login - nonexisting ident', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {ident: 'test2@example.com'},
    });
    expect(r1.statusCode).toBe(400);
  })

  it('POST /auth/login - invalid password', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {ident: 'test@example.com', password: 'hello1234'},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/login - email', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {ident: 'test@example.com', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(200);
    const cookies = extractCookies(r1.headers['set-cookie']);
    rt1 = cookies.refresh_token;
    at = r1.json().at;

    const account = r1.json().account;
    expect(account).toMatchObject({username: "test1", email: "test@example.com"})
    expect(account).not.toHaveProperty("passwordHash");
  })

  it('GET /auth/me - missing access token', async () => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        // 'Authorization': `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(401);
  })

  it('GET /auth/me - invalid access token', async () => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        'Authorization': 'Bearer banana',
      },
    });
    expect(r1.statusCode).toBe(401);
  })

  it('GET /auth/me', async () => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        'Authorization': `Bearer ${at}`,
      },
    });
    expect(r1.statusCode).toBe(200);
    const res = r1.json();
    expect(res.isOAuthAccount).toBe(false);
    const account = res.account;
    expect(account).toMatchObject({username: "test1", email: "test@example.com"})
    expect(account).not.toHaveProperty("passwordHash");
  })

  it('PUT /auth/me - missing access token', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me',
      headers: {
        // 'Authorization': `Bearer ${at}`,
        'content-type': 'application/json',
      },
      payload: {
        username: 'test2',
        email: 'test2@example.com',
      },
    });
    expect(r1.statusCode).toBe(401);
  })

  it('PUT /auth/me', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me',
      headers: {
        'Authorization': `Bearer ${at}`,
        'content-type': 'application/json',
      },
      payload: {
        username: 'test2',
        email: 'test2@example.com',
      },
    });
    expect(r1.statusCode).toBe(200);
    const account = r1.json().account;
    expect(account).toMatchObject({username: "test2", email: "test2@example.com"})
    expect(account).not.toHaveProperty("passwordHash");
  })

  it('POST /auth/signup - second account', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      headers: {'content-type': 'application/json'},
      payload: {username: 'test1', email: 'test@example.com', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(200);
    const account = r1.json().account;

    expect(account).toMatchObject({username: "test1", email: "test@example.com"})
    expect(account).not.toHaveProperty("passwordHash");

    const newAccount = await app.prisma.account.findUnique({where: {email: 'test@example.com'}});
    expect(newAccount).toBeDefined();
    expect(await argon2.verify(newAccount!.passwordHash!, "hello123")).toBe(true);
  })

  it('POST /auth/login - username', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {ident: 'test1', password: 'hello123'},
    });
    expect(r1.statusCode).toBe(200);
    const res = r1.json();
    at2 = res.at;
    const account = res.account;
    expect(account).toMatchObject({username: "test1", email: "test@example.com"})
    expect(account).not.toHaveProperty("passwordHash");
  })

  it('PUT /auth/me', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me',
      headers: {
        'Authorization': `Bearer ${at2}`,
        'content-type': 'application/json',
      },
      payload: {
        username: 'test2',
        email: 'test2@example.com',
      },
    });
    expect(r1.statusCode).toBe(409);
  })

  it('PUT /auth/me/password - missing access token', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me/password',
      headers: {
        // 'Authorization': `Bearer ${at}`,
        'content-type': 'application/json',
      },
      payload: {
        currentPassword: 'hello123',
        newPassword: 'newpass123',
      },
    });
    expect(r1.statusCode).toBe(401);
  })

  it('PUT /auth/me/password - missing currentPassword', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me/password',
      headers: {
        'Authorization': `Bearer ${at}`,
        'content-type': 'application/json',
      },
      payload: {
        // currentPassword: 'hello123',
        newPassword: 'newpass123',
      },
    });
    expect(r1.statusCode).toBe(400);
  })

  it('PUT /auth/me/password - missing newPassword', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me/password',
      headers: {
        'Authorization': `Bearer ${at}`,
        'content-type': 'application/json',
      },
      payload: {
        currentPassword: 'hello123',
        // newPassword: 'newpass123',
      },
    });
    expect(r1.statusCode).toBe(400);
  })

  it('PUT /auth/me/password', async () => {
    const r1 = await app.inject({
      method: 'PUT',
      url: '/auth/me/password',
      headers: {
        'Authorization': `Bearer ${at}`,
        'content-type': 'application/json',
      },
      payload: {
        currentPassword: 'hello123',
        newPassword: 'newpass123',
      },
    });
    expect(r1.statusCode).toBe(200);

    const account = r1.json().account;
    expect(account).toMatchObject({username: "test2", email: "test2@example.com"})
    expect(account).not.toHaveProperty("passwordHash");

    const newAccount = await app.prisma.account.findUnique({where: {email: 'test2@example.com'}});
    expect(newAccount).toBeDefined();
    expect(await argon2.verify(newAccount!.passwordHash!, "hello123")).toBe(false);
    expect(await argon2.verify(newAccount!.passwordHash!, "newpass123")).toBe(true);
  })

  it('GET /auth/', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/auth/',
    });
    expect(r1.statusCode).toBe(200);
    const accounts = r1.json().accounts;
    expect(accounts).toContainEqual({id: accountId, username: 'test2', email: 'test2@example.com'});
    expect(accounts.every(o => !("passwordHash" in o))).toBe(true)
  });

  it('GET /auth/:accountId', async() => {
    const r1 = await app.inject({
      method: 'GET',
      url: `/auth/${accountId}`,
    });
    expect(r1.statusCode).toBe(200);
    const account = r1.json().account;
    expect(account).toMatchObject({id: accountId, username: 'test2', email: 'test2@example.com'});
    expect(account).not.toHaveProperty("passwordHash");
  });

  it('POST /auth/refresh - missing refresh token cookie', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/refresh - invalid refresh token cookie', async () => {
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

  it('POST /auth/logout - missing refresh token', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });
    expect(r1.statusCode).toBe(200);
  })

  it('POST /auth/logout - invalid refresh token cookie', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: {'refresh_token': 'banana'},
    });
    expect(r1.statusCode).toBe(401);
  })

  it('POST /auth/logout - old refresh token', async () => {
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

  it('POST /auth/login - username', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {ident: 'test2', password: 'newpass123'},
    });
    expect(r1.statusCode).toBe(200);

    const account = r1.json().account;
    expect(account).toMatchObject({username: "test2", email: "test2@example.com"})
    expect(account).not.toHaveProperty("passwordHash");
  })


  it('DELETE /auth/me', async () => {
    const r1 = await app.inject({
      method: 'DELETE',
      url: '/auth/me',
      headers: {'Authorization': `Bearer ${at}`},
    });
    expect(r1.statusCode).toBe(200);
    const account = r1.json().account;
    expect(account).toMatchObject({username: 'test2', email: 'test2@example.com'})
  })

  it('POST /auth/login - username', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {'content-type': 'application/json'},
      payload: {ident: 'test2', password: 'newpass123'},
    });
    expect(r1.statusCode).toBe(401);

    const account = await app.prisma.account.findUnique({where: {email: 'test2@example.com'}});
    expect(account).toBe(null);
  })
})
