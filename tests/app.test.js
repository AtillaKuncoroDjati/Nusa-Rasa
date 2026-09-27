import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import sharp from 'sharp';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { openDatabase, databaseConfig, databaseIdentifier } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seed } from '../server/seed.js';

async function setup(t, { sendReset } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'nusa-rasa-test-'));
  const database = 'nusa_rasa_test_' + randomUUID().replaceAll('-', '');
  const connection = await mysql.createConnection({ ...databaseConfig(), database: undefined });
  let db, server;
  let created = false;
  t.after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await db?.close();
    assert.match(database, /^nusa_rasa_test_[a-f0-9]{32}$/);
    if (created) await connection.query('DROP DATABASE ' + databaseIdentifier(database));
    await connection.end();
    const target = resolve(root);
    assert.equal(dirname(target).toLowerCase(), resolve(tmpdir()).toLowerCase());
    assert.match(basename(target), /^nusa-rasa-test-/);
    await rm(target, { recursive: true, force: true });
  });
  // Never use or truncate the development database for tests.
  await connection.query(
    'CREATE DATABASE ' +
      databaseIdentifier(database) +
      ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  created = true;
  db = await openDatabase({ database });
  await db.initialize();
  await seed(db);
  const origin = 'http://localhost:4180',
    app = createApp({ db, root, origin, sendReset, skipLimits: true });
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { method = 'GET', body, session, headers = {} } = {}) => {
    const form = body instanceof FormData;
    const response = await fetch(url + '/api' + path, {
      method,
      headers: {
        ...(method !== 'GET' ? { Origin: origin } : {}),
        ...(body && !form ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}),
        ...headers,
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const register = async (name, email = 'one@example.com') => {
    const r = await request('/auth/register', {
      method: 'POST',
      body: { name, email, password: 'Testing-only-2026!' },
    });
    assert.equal(r.status, 201);
    return { ...r.data, cookie: r.cookie };
  };
  return { db, database, request, register, root, url };
}
const sample = {
  title: 'Resep uji dari dapur',
  description: 'Resep pengujian yang dibuat hanya untuk pengujian aplikasi.',
  region: 'Jawa Barat',
  minutes: 25,
  servings: 2,
  ingredients: ['200 g bahan utama', '1 sdt bumbu'],
  steps: ['Campurkan semua bahan sampai rata.', 'Masak hingga matang, lalu sajikan.'],
};
async function imageUpload(request, session) {
  const data = new FormData();
  data.append(
    'image',
    new Blob(
      [
        await sharp({ create: { width: 16, height: 16, channels: 3, background: '#ff9900' } })
          .png()
          .toBuffer(),
      ],
      { type: 'image/png' },
    ),
    'foto.png',
  );
  const r = await request('/uploads', { method: 'POST', body: data, session });
  assert.equal(r.status, 201);
  assert.match(r.data.path, /^\/uploads\/[a-f0-9-]+\.webp$/);
  return r.data.path;
}

test('registration hashes passwords, sessions authenticate, logout invalidates them', async (t) => {
  const { db, request, register } = await setup(t),
    session = await register('Pengguna Satu');
  assert.match(session.cookie, /nusa_session=/);
  assert.ok(session.csrf);
  const row = await db.get('SELECT * FROM users WHERE id=?', session.user.id);
  assert.notEqual(row.password_hash, 'Testing-only-2026!');
  assert.match(row.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal((await request('/session', { session })).data.user.name, 'Pengguna Satu');
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'one@example.com', password: 'incorrect' },
      })
    ).status,
    401,
  );
  assert.equal((await request('/auth/logout', { method: 'POST', session })).status, 200);
  assert.equal((await request('/session', { session })).data.user, null);
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: 'ONE@example.com', password: 'Testing-only-2026!' },
  });
  assert.equal(login.status, 200);
  assert.notEqual(login.cookie, session.cookie);
});
test('write requests require same origin, authentication, and a session CSRF token', async (t) => {
  const { request, register } = await setup(t),
    session = await register('Pengguna Satu');
  assert.equal((await request('/recipes', { method: 'POST', body: sample })).status, 401);
  assert.equal(
    (
      await request('/profile', {
        method: 'PATCH',
        body: {},
        session,
        headers: { Origin: 'https://other.example' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/profile', {
        method: 'PATCH',
        body: {},
        session,
        headers: { 'X-CSRF-Token': 'invalid' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/auth/register', { method: 'POST', body: {}, headers: { Origin: '' } })).status,
    403,
  );
});
test('recipes persist in MySQL, search filters work, and another account cannot edit or delete', async (t) => {
  const { database, request, register } = await setup(t),
    a = await register('Pemilik'),
    b = await register('Pengunjung', 'two@example.com');
  const image = await imageUpload(request, a);
  const made = await request('/recipes', {
    method: 'POST',
    body: { ...sample, image },
    session: a,
  });
  assert.equal(made.status, 201);
  const id = made.data.recipe.id;
  assert.equal(
    (await request('/recipes?q=resep%20uji&region=Jawa%20Barat')).data.recipes.length,
    1,
  );
  assert.equal((await request('/recipes?scope=mine', { session: b })).data.recipes.length, 0);
  assert.equal(
    (await request('/recipes/' + id, { method: 'PUT', body: { ...sample, image }, session: b }))
      .status,
    403,
  );
  assert.equal((await request('/recipes/' + id, { method: 'DELETE', session: b })).status, 403);
  const changed = await request('/recipes/' + id, {
    method: 'PUT',
    body: { ...sample, title: 'Resep uji diperbarui', image },
    session: a,
  });
  assert.equal(changed.status, 200);
  const second = await openDatabase({ database });
  try {
    assert.equal(
      (await second.get('SELECT title FROM recipes WHERE id=?', id)).title,
      'Resep uji diperbarui',
    );
  } finally {
    await second.close();
  }
  assert.equal((await request('/recipes/' + id, { method: 'DELETE', session: a })).status, 200);
  assert.equal((await request('/recipes/' + id)).status, 404);
});
test('likes and bookmarks are idempotent, user-specific, and notify the author', async (t) => {
  const { db, request, register } = await setup(t),
    a = await register('Pemilik'),
    b = await register('Pengunjung', 'two@example.com');
  const image = await imageUpload(request, a),
    made = await request('/recipes', { method: 'POST', body: { ...sample, image }, session: a }),
    id = made.data.recipe.id;
  for (let i = 0; i < 2; i++)
    await request(`/recipes/${id}/like`, { method: 'PUT', body: { active: true }, session: b });
  assert.equal((await request('/recipes/' + id, { session: b })).data.recipe.like_count, 1);
  await request(`/recipes/${id}/bookmark`, { method: 'PUT', body: { active: true }, session: b });
  assert.equal((await request('/recipes?scope=saved', { session: b })).data.recipes.length, 1);
  assert.equal((await request('/recipes?scope=saved', { session: a })).data.recipes.length, 0);
  assert.equal(
    (await db.get('SELECT COUNT(*) AS n FROM notifications WHERE recipe_id=?', id)).n,
    1,
  );
  await request(`/recipes/${id}/comments`, {
    method: 'POST',
    body: { body: 'Terima kasih, resepnya mudah diikuti.' },
    session: b,
  });
  assert.equal((await request(`/recipes/${id}/comments`)).data.comments.length, 1);
  await request('/notifications/read', { method: 'PATCH', session: a });
  assert.ok(
    (await request('/notifications', { session: a })).data.notifications.every((n) => n.seen === 1),
  );
});
test('validation rejects invalid photos, unowned uploads, short passwords and malformed recipes', async (t) => {
  const { request, register } = await setup(t),
    a = await register('Pemilik'),
    b = await register('Pengunjung', 'two@example.com');
  const image = await imageUpload(request, a);
  assert.equal(
    (await request('/recipes', { method: 'POST', body: { ...sample, image }, session: b })).status,
    400,
  );
  assert.equal(
    (
      await request('/recipes', {
        method: 'POST',
        body: { ...sample, image, steps: [] },
        session: a,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/recipes', {
        method: 'POST',
        body: { ...sample, image: 'https://external.example/x.png' },
        session: a,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/profile', {
        method: 'PATCH',
        body: { name: 'Other', bio: '', avatar: image },
        session: b,
      })
    ).status,
    400,
  );
  const bad = new FormData();
  bad.append(
    'image',
    new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], {
      type: 'image/svg+xml',
    }),
    'bad.svg',
  );
  assert.equal((await request('/uploads', { method: 'POST', body: bad, session: a })).status, 400);
  assert.equal(
    (
      await request('/auth/register', {
        method: 'POST',
        body: { name: 'Short', email: 'short@example.com', password: '123' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/auth/register', {
        method: 'POST',
        body: { name: 'Duplicate', email: 'one@example.com', password: 'Valid-password-2026' },
      })
    ).status,
    409,
  );
});
test('password reset is single-use, expires, and revokes all existing sessions', async (t) => {
  let mail;
  const { db, request, register } = await setup(t, {
      sendReset: async (email, url) => {
        mail = { email, url };
      },
    }),
    session = await register('Pemilik');
  assert.equal(
    (await request('/auth/forgot', { method: 'POST', body: { email: 'one@example.com' } })).status,
    200,
  );
  assert.equal(mail.email, 'one@example.com');
  const token = new URL(mail.url).hash.slice(1);
  assert.equal(
    (
      await request('/auth/reset', {
        method: 'POST',
        body: { token, password: 'Changed-for-testing!' },
      })
    ).status,
    200,
  );
  assert.equal((await request('/session', { session })).data.user, null);
  assert.equal(
    (
      await request('/auth/reset', {
        method: 'POST',
        body: { token, password: 'Changed-for-testing!' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'one@example.com', password: 'Testing-only-2026!' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'one@example.com', password: 'Changed-for-testing!' },
      })
    ).status,
    200,
  );
  await request('/auth/forgot', { method: 'POST', body: { email: 'one@example.com' } });
  await db.run('UPDATE password_resets SET expires_at=0');
  assert.equal(
    (
      await request('/auth/reset', {
        method: 'POST',
        body: { token: new URL(mail.url).hash.slice(1), password: 'Changed-again-testing!' },
      })
    ).status,
    400,
  );
});
test('password recovery is explicitly unavailable without a mail delivery service', async (t) => {
  const { request } = await setup(t);
  assert.equal((await request('/config')).data.passwordResetEnabled, false);
  assert.equal(
    (await request('/auth/forgot', { method: 'POST', body: { email: 'one@example.com' } })).status,
    503,
  );
});

test('MySQL transactions roll back and concurrent likes/reset requests remain consistent', async (t) => {
  let resetUrl;
  const { db, request, register } = await setup(t, {
    sendReset: async (email, url) => {
      resetUrl = url;
    },
  });
  const session = await register('Dapur Uji 🍲');
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.run(
        'UPDATE users SET bio=? WHERE id=?',
        'Perubahan yang dibatalkan',
        session.user.id,
      );
      throw new Error('rollback probe');
    }),
    /rollback probe/,
  );
  assert.equal((await db.get('SELECT bio FROM users WHERE id=?', session.user.id)).bio, '');
  const likes = await Promise.all(
    Array.from({ length: 4 }, () =>
      request('/recipes/1/like', { method: 'PUT', body: { active: true }, session }),
    ),
  );
  assert.ok(likes.every((r) => r.status === 200));
  assert.equal((await request('/recipes/1', { session })).data.recipe.like_count, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM notifications WHERE recipe_id=1')).n, 1);
  await request('/auth/forgot', { method: 'POST', body: { email: 'one@example.com' } });
  const token = new URL(resetUrl).hash.slice(1);
  const resets = await Promise.all(
    Array.from({ length: 2 }, () =>
      request('/auth/reset', {
        method: 'POST',
        body: { token, password: 'Concurrent-reset-2026!' },
      }),
    ),
  );
  assert.deepEqual(resets.map((r) => r.status).sort(), [200, 400]);
  assert.equal((await request('/session', { session })).data.user, null);
});

async function videoUpload(request, session, extension = 'mp4') {
  const bytes = await readFile(new URL('./fixtures/recipe-video.' + extension, import.meta.url));
  const form = new FormData();
  form.append('video', new Blob([bytes], { type: 'video/' + extension }), 'recipe.' + extension);
  const result = await request('/uploads/video', { method: 'POST', body: form, session });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.match(result.data.path, new RegExp('^/uploads/[a-f0-9-]+\\.' + extension + '$'));
  assert.ok(result.data.duration > 0);
  return { path: result.data.path, bytes };
}

test('video uploads persist, support seeking, and can be replaced or removed from a recipe', async (t) => {
  const { db, database, request, register, root, url } = await setup(t);
  const owner = await register('Pemilik Video');
  const image = await imageUpload(request, owner);
  const mp4 = await videoUpload(request, owner),
    webm = await videoUpload(request, owner, 'webm');
  const made = await request('/recipes', {
    method: 'POST',
    body: { ...sample, image, video: mp4.path },
    session: owner,
  });
  assert.equal(made.status, 201);
  assert.equal(made.data.recipe.video, mp4.path);
  const id = made.data.recipe.id;
  const range = await fetch(url + mp4.path, { headers: { Range: 'bytes=0-31' } });
  assert.equal(range.status, 206);
  assert.match(range.headers.get('content-type'), /^video\/mp4/);
  assert.equal(range.headers.get('content-range'), `bytes 0-31/${mp4.bytes.length}`);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), mp4.bytes.subarray(0, 32));
  const second = await openDatabase({ database });
  try {
    assert.equal((await second.get('SELECT video FROM recipes WHERE id=?', id)).video, mp4.path);
  } finally {
    await second.close();
  }
  assert.equal(
    (await request('/recipes/' + id, { method: 'PUT', body: { ...sample, image }, session: owner }))
      .data.recipe.video,
    mp4.path,
  );
  assert.equal(
    (
      await request('/recipes/' + id, {
        method: 'PUT',
        body: { ...sample, image, video: webm.path },
        session: owner,
      })
    ).data.recipe.video,
    webm.path,
  );
  assert.equal(
    (
      await request('/recipes/' + id, {
        method: 'PUT',
        body: { ...sample, image, video: '' },
        session: owner,
      })
    ).data.recipe.video,
    '',
  );
  assert.deepEqual(await readdir(join(root, 'data/upload-tmp')), []);
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM uploads WHERE kind='video'")).n, 2);
});

test('video ownership, file types, authentication, CSRF and upload size are enforced', async (t) => {
  const { db, request, register, root } = await setup(t);
  const owner = await register('Pemilik Video'),
    other = await register('Pengguna Lain', 'other@example.com');
  const image = await imageUpload(request, owner),
    video = (await videoUpload(request, owner)).path;
  const otherImage = await imageUpload(request, other);
  const create = (body, session = owner) =>
    request('/recipes', { method: 'POST', body: { ...sample, image, ...body }, session });
  assert.equal((await create({ image: otherImage, video }, other)).status, 400);
  assert.equal((await create({ video: 'https://example.com/video.mp4' })).status, 400);
  assert.equal((await create({ video: image })).status, 400);
  assert.equal((await create({ image: video })).status, 400);
  assert.equal(
    (
      await request('/profile', {
        method: 'PATCH',
        body: { name: 'Uji Video', bio: '', avatar: video },
        session: owner,
      })
    ).status,
    400,
  );
  const made = await create({ video });
  assert.equal(
    (
      await request('/recipes/' + made.data.recipe.id, {
        method: 'PUT',
        body: { ...sample, image, video: '' },
        session: other,
      })
    ).status,
    403,
  );
  const sendFile = (bytes, options = {}) => {
    const form = new FormData();
    form.append('video', new Blob([bytes], { type: 'video/mp4' }), 'fake.mp4');
    return request('/uploads/video', { method: 'POST', body: form, session: owner, ...options });
  };
  assert.equal((await sendFile('fake', { session: undefined })).status, 401);
  assert.equal((await sendFile('fake', { headers: { 'X-CSRF-Token': 'wrong' } })).status, 403);
  assert.equal((await sendFile('<html><script>alert(1)</script></html>')).status, 400);
  assert.equal(
    (
      await sendFile(
        await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
          .png()
          .toBuffer(),
      )
    ).status,
    400,
  );
  const tooLarge = await sendFile(Buffer.alloc(50 * 1024 * 1024 + 1));
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.data.error, 'Video maksimal 50 MB.');
  assert.deepEqual(await readdir(join(root, 'data/upload-tmp')), []);
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM uploads WHERE kind='video'")).n, 1);
});

test('upgrading the old schema preserves recipes and marks existing uploads as images', async (t) => {
  const { db } = await setup(t);
  await db.run('DELETE FROM schema_migrations');
  await db.run('ALTER TABLE recipes DROP COLUMN video');
  await db.run('ALTER TABLE uploads DROP COLUMN kind');
  await db.run('INSERT INTO uploads(path,user_id) VALUES(?,1)', '/uploads/legacy.webp');
  await db.initialize();
  await db.initialize();
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM recipes')).n, 6);
  assert.equal((await db.get('SELECT video FROM recipes WHERE id=1')).video, '');
  assert.equal(
    (await db.get('SELECT kind FROM uploads WHERE path=?', '/uploads/legacy.webp')).kind,
    'image',
  );
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM schema_migrations')).n, 1);
});

test('ingredient search requires every ingredient, escapes wildcards, and combines time, region and saved filters', async (t) => {
  const { request, register } = await setup(t);
  const a = await register('Pencari Resep');
  const image = await imageUpload(request, a);
  const made = await request('/recipes', {
    method: 'POST',
    session: a,
    body: {
      ...sample,
      image,
      title: 'Menu keluarga hari ini',
      ingredients: ['200 g ayam segar', '2 butir telur'],
      minutes: 20,
    },
  });
  const id = made.data.recipe.id;
  await request(`/recipes/${id}/bookmark`, { method: 'PUT', session: a, body: { active: true } });
  const search = (args) => request('/recipes?' + new URLSearchParams(args), { session: a });
  assert.deepEqual(
    (
      await search({
        ingredients: 'AYAM, telur',
        maxMinutes: '30',
        region: 'Jawa Barat',
        scope: 'saved',
      })
    ).data.recipes.map((r) => r.id),
    [id],
  );
  assert.equal(
    (await search({ ingredients: 'ayam, telur', maxMinutes: '15' })).data.recipes.length,
    0,
  );
  assert.equal(
    (await search({ ingredients: 'ayam, bahan-yang-tidak-ada' })).data.recipes.length,
    0,
  );
  assert.equal((await search({ ingredients: '%' })).data.recipes.length, 0);
  assert.equal((await search({ q: '_' })).data.recipes.length, 0);
  assert.ok((await search({ q: 'ayam' })).data.recipes.some((r) => r.id === id));
  assert.equal((await search({ ingredients: 'a,b,c,d,e,f,g' })).status, 400);
  assert.equal((await search({ ingredients: 'a'.repeat(41) })).status, 400);
  assert.equal((await search({ maxMinutes: 'nope' })).status, 400);
  assert.equal((await search({ maxMinutes: '0' })).status, 400);
});

test('recipe reviews keep one rating per cook, persist photos, enforce ownership, and update averages', async (t) => {
  const { db, database, request, register } = await setup(t);
  const owner = await register('Pemilik Resep'),
    a = await register('Pencoba A', 'review-a@example.invalid'),
    b = await register('Pencoba B', 'review-b@example.invalid');
  const image = await imageUpload(request, owner),
    photo = await imageUpload(request, a),
    otherPhoto = await imageUpload(request, b);
  const id = (
    await request('/recipes', { method: 'POST', session: owner, body: { ...sample, image } })
  ).data.recipe.id;
  const path = `/recipes/${id}/review`,
    body = { rating: 5, body: 'Resepnya sudah dicoba dan mudah diikuti.', image: photo };
  assert.equal((await request(path, { method: 'PUT', body })).status, 401);
  assert.equal(
    (
      await request(path, {
        method: 'PUT',
        body,
        session: a,
        headers: { 'X-CSRF-Token': 'invalid' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request(path, { method: 'PUT', body: { ...body, image }, session: owner })).status,
    403,
  );
  assert.equal(
    (await request(path, { method: 'PUT', body: { ...body, image: otherPhoto }, session: a }))
      .status,
    400,
  );
  assert.equal(
    (await request(path, { method: 'PUT', body: { ...body, rating: 6 }, session: a })).status,
    400,
  );
  assert.equal(
    (await request(path, { method: 'PUT', body: { ...body, rating: 2.5 }, session: a })).status,
    400,
  );
  assert.equal(
    (
      await request(path, {
        method: 'PUT',
        body: { ...body, image: 'https://example.com/photo.jpg' },
        session: a,
      })
    ).status,
    400,
  );
  const saves = await Promise.all(
    Array.from({ length: 3 }, () => request(path, { method: 'PUT', body, session: a })),
  );
  assert.ok(saves.every((r) => r.status === 200));
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM reviews WHERE recipe_id=?', id)).n, 1);
  assert.equal(
    (await db.get('SELECT COUNT(*) AS n FROM notifications WHERE recipe_id=?', id)).n,
    1,
  );
  const second = await openDatabase({ database });
  try {
    assert.equal(
      (await second.get('SELECT image FROM reviews WHERE recipe_id=? AND user_id=?', id, a.user.id))
        .image,
      photo,
    );
  } finally {
    await second.close();
  }
  let r = await request(path, {
    method: 'PUT',
    body: { rating: 3, body: 'Bumbunya bisa disesuaikan lagi.', image: otherPhoto },
    session: b,
  });
  assert.equal(r.data.recipe.review_count, 2);
  assert.equal(r.data.recipe.rating_average, 4);
  r = await request(path, { method: 'PUT', body: { ...body, rating: 4, image: '' }, session: a });
  assert.equal(r.data.recipe.review_count, 2);
  assert.equal(r.data.recipe.rating_average, 3.5);
  const listing = await request(`/recipes/${id}/reviews`, { session: a });
  assert.equal(listing.data.mine.rating, 4);
  assert.equal(listing.data.mine.image, '');
  assert.equal((await request(`/recipes/${id}/reviews`)).data.mine, null);
  // Deleting this account's review must not touch the other cook's review.
  r = await request(path, { method: 'DELETE', session: a });
  assert.equal(r.data.recipe.review_count, 1);
  assert.equal(r.data.recipe.rating_average, 3);
  assert.equal(
    (await request(`/recipes/${id}/reviews`, { session: b })).data.mine.image,
    otherPhoto,
  );
  await db.run(
    'INSERT INTO comments(user_id,recipe_id,body) VALUES(?,?,?)',
    b.user.id,
    id,
    'Komentar lama tetap ada.',
  );
  await db.initialize();
  await db.initialize();
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM reviews WHERE recipe_id=?', id)).n, 1);
  assert.equal(
    (await request(`/recipes/${id}/comments`)).data.comments[0].body,
    'Komentar lama tetap ada.',
  );
  await request('/recipes/' + id, { method: 'DELETE', session: owner });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM reviews WHERE recipe_id=?', id)).n, 0);
  assert.equal((await request(path, { method: 'PUT', body, session: a })).status, 404);
});
