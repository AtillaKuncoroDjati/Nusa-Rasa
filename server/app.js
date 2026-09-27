import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import nodemailer from 'nodemailer';
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { registerVideoUploads } from './video.js';
import { registerReviews } from './reviews.js';
import { z } from 'zod';
import { digest, randomToken, hashPassword, verifyPassword, publicUser } from './auth.js';
import {
  regions,
  registerSchema,
  loginSchema,
  profileSchema,
  recipeSchema,
  email,
  password,
  parse,
  fail,
} from './validation.js';

export function createApp({
  db,
  root,
  origin = 'http://127.0.0.1:4180',
  production = false,
  sendReset,
  skipLimits = false,
}) {
  const app = express(),
    uploadDir = resolve(root, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'blob:', 'data:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use('/api', express.json({ limit: '80kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 200,
      skip: () => skipLimits,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Terlalu banyak permintaan. Coba sebentar lagi.' },
    }),
  );
  app.use('/api', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Reject cross-site forms and requests sent from an unrecognized host.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== origin)
      return res.status(403).json({ error: 'Permintaan harus berasal dari aplikasi Nusa Rasa.' });
    const cookie = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('nusa_session='))
      ?.slice(13);
    if (cookie && /^[a-f0-9]{64}$/.test(cookie)) {
      req.session = await db.get(
        'SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',
        digest(cookie),
        Date.now(),
      );
      if (req.session)
        req.user = await db.get('SELECT * FROM users WHERE id=?', req.session.user_id);
    }
    next();
  });
  function auth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Masuk dulu untuk melanjutkan.' });
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-CSRF-Token') !== req.session.csrf)
      return res.status(403).json({ error: 'Sesi formulir tidak valid. Muat ulang halaman.' });
    next();
  }
  async function login(res, user) {
    const token = randomToken(),
      csrf = randomToken();
    await db.run('DELETE FROM sessions WHERE expires_at<=?', Date.now());
    await db.run(
      'INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',
      digest(token),
      user.id,
      csrf,
      Date.now() + 7 * 86400_000,
    );
    res.cookie('nusa_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      path: '/',
      maxAge: 7 * 86400_000,
    });
    return { user: publicUser(user), csrf };
  }
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    skip: () => skipLimits,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.' },
  });
  const mailReady = Boolean(sendReset || (process.env.SMTP_HOST && process.env.MAIL_FROM));
  const resetDelivery =
    sendReset ||
    (async (recipient, url) => {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === '465',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transport.sendMail({
        from: process.env.MAIL_FROM,
        to: recipient,
        subject: 'Atur ulang kata sandi Nusa Rasa',
        text: `Buka tautan berikut untuk mengatur ulang kata sandi (berlaku 30 menit):\n${url}\n\nAbaikan pesan ini jika kamu tidak meminta perubahan.`,
      });
    });
  app.get('/api/config', (req, res) => res.json({ regions, passwordResetEnabled: mailReady }));
  app.get('/api/session', (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.session?.csrf || null }),
  );
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const data = parse(registerSchema, req.body),
      encoded = await hashPassword(data.password);
    let id;
    try {
      id = await db.transaction(async (tx) => {
        const result = await tx.run(
          'INSERT INTO users(name,email,password_hash) VALUES(?,?,?)',
          data.name,
          data.email,
          encoded,
        );
        await tx.run(
          'INSERT INTO notifications(user_id,message) VALUES(?,?)',
          result.insertId,
          'Selamat datang di Nusa Rasa! Bagikan resep pertamamu dan mulai jelajahi cita rasa Nusantara.',
        );
        return result.insertId;
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') fail(409, 'Email sudah terdaftar. Silakan masuk.');
      throw error;
    }
    res.status(201).json(await login(res, await db.get('SELECT * FROM users WHERE id=?', id)));
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const data = parse(loginSchema, req.body),
      user = await db.get('SELECT * FROM users WHERE email=?', data.email);
    if (!(await verifyPassword(data.password, user?.password_hash)))
      fail(401, 'Email atau kata sandi tidak sesuai.');
    if (req.session)
      await db.run('DELETE FROM sessions WHERE token_hash=?', req.session.token_hash);
    res.json(await login(res, user));
  });
  app.post('/api/auth/logout', auth, async (req, res) => {
    await db.run('DELETE FROM sessions WHERE token_hash=?', req.session.token_hash);
    res.clearCookie('nusa_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      path: '/',
    });
    res.json({ ok: true });
  });
  app.post('/api/auth/forgot', authLimit, async (req, res) => {
    const data = parse(z.object({ email }), req.body);
    if (!mailReady) fail(503, 'Pemulihan lewat email belum tersedia. Hubungi pengelola aplikasi.');
    const user = await db.get(
      'SELECT * FROM users WHERE email=? AND password_hash IS NOT NULL',
      data.email,
    );
    if (user) {
      const token = randomToken();
      await db.transaction(async (tx) => {
        // Serialize reset requests for the same account; at most one link remains valid.
        await tx.get('SELECT id FROM users WHERE id=? FOR UPDATE', user.id);
        await tx.run('DELETE FROM password_resets WHERE user_id=?', user.id);
        await tx.run(
          'INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)',
          digest(token),
          user.id,
          Date.now() + 30 * 60_000,
        );
      });
      try {
        await resetDelivery(user.email, `${origin}/reset-password#${token}`);
      } catch {
        await db.run('DELETE FROM password_resets WHERE token_hash=?', digest(token));
        console.error('Password reset email delivery failed. Check SMTP configuration.');
      }
    }
    res.json({
      message:
        'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam.',
    });
  });
  app.post('/api/auth/reset', authLimit, async (req, res) => {
    const data = parse(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password }), req.body),
      encoded = await hashPassword(data.password);
    const candidate = await db.get(
      'SELECT user_id FROM password_resets WHERE token_hash=?',
      digest(data.token),
    );
    if (!candidate) fail(400, 'Tautan pemulihan sudah kedaluwarsa atau sudah dipakai.');
    await db.transaction(async (tx) => {
      // Lock the user first, matching the reset-request lock order.
      await tx.get('SELECT id FROM users WHERE id=? FOR UPDATE', candidate.user_id);
      const row = await tx.get(
        'SELECT * FROM password_resets WHERE token_hash=? AND expires_at>? FOR UPDATE',
        digest(data.token),
        Date.now(),
      );
      if (!row) fail(400, 'Tautan pemulihan sudah kedaluwarsa atau sudah dipakai.');
      await tx.run('UPDATE users SET password_hash=? WHERE id=?', encoded, row.user_id);
      await tx.run('DELETE FROM password_resets WHERE user_id=?', row.user_id);
      await tx.run('DELETE FROM sessions WHERE user_id=?', row.user_id);
    });
    res.json({ ok: true });
  });
  async function ownedImage(path, userId) {
    return Boolean(
      await db.get(
        "SELECT path FROM uploads WHERE path=? AND user_id=? AND kind='image'",
        path,
        userId,
      ),
    );
  }
  async function ownedVideo(path, userId) {
    return Boolean(
      await db.get(
        "SELECT path FROM uploads WHERE path=? AND user_id=? AND kind='video'",
        path,
        userId,
      ),
    );
  }
  app.patch('/api/profile', auth, async (req, res) => {
    const data = parse(profileSchema, req.body);
    if (
      data.avatar &&
      data.avatar !== req.user.avatar &&
      !(await ownedImage(data.avatar, req.user.id))
    )
      fail(400, 'Gunakan foto profil yang kamu unggah sendiri.');
    await db.run(
      'UPDATE users SET name=?,bio=?,avatar=? WHERE id=?',
      data.name,
      data.bio,
      data.avatar,
      req.user.id,
    );
    res.json({ user: publicUser(await db.get('SELECT * FROM users WHERE id=?', req.user.id)) });
  });
  const select = `SELECT r.*, u.name AS author_name, u.avatar AS author_avatar,
    (SELECT COUNT(*) FROM reviews v WHERE v.recipe_id=r.id) AS review_count,
    (SELECT AVG(v.rating) FROM reviews v WHERE v.recipe_id=r.id) AS rating_average,
    (SELECT COUNT(*) FROM likes l WHERE l.recipe_id=r.id) AS like_count,
    EXISTS(SELECT 1 FROM likes l WHERE l.recipe_id=r.id AND l.user_id=?) AS liked,
    EXISTS(SELECT 1 FROM bookmarks b WHERE b.recipe_id=r.id AND b.user_id=?) AS saved
    FROM recipes r JOIN users u ON r.author_id=u.id`;
  const serialize = (row) => ({
    ...row,
    rating_average: row.rating_average === null ? null : Number(row.rating_average),
    ingredients: JSON.parse(row.ingredients),
    steps: JSON.parse(row.steps),
    liked: Boolean(row.liked),
    saved: Boolean(row.saved),
  });
  async function recipe(id, userId = 0) {
    const row = await db.get(select + ' WHERE r.id=?', userId, userId, id);
    if (!row) fail(404, 'Resep tidak ditemukan.');
    return serialize(row);
  }
  app.get('/api/recipes', async (req, res) => {
    const query = parse(
      z.object({
        q: z.string().max(100).default(''),
        ingredients: z.string().max(240).default(''),
        maxMinutes: z.coerce.number().int().min(1).max(1440).optional(),
        region: z.string().max(40).default(''),
        scope: z.enum(['all', 'saved', 'mine']).default('all'),
        sort: z.enum(['popular', 'newest']).default('popular'),
      }),
      req.query,
    );
    if (query.scope !== 'all' && !req.user) fail(401, 'Masuk dulu untuk melihat koleksimu.');
    const params = [req.user?.id || 0, req.user?.id || 0],
      clauses = [];
    if (query.q) {
      clauses.push(
        "(r.title LIKE ? ESCAPE '=' OR r.description LIKE ? ESCAPE '=' OR r.region LIKE ? ESCAPE '=' OR r.ingredients LIKE ? ESCAPE '=')",
      );
      const pattern = '%' + query.q.replace(/[=%_]/g, (c) => '=' + c) + '%';
      params.push(pattern, pattern, pattern, pattern);
    }
    const ingredients = [
      ...new Set(
        query.ingredients
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (ingredients.length > 6 || ingredients.some((s) => s.length > 40))
      fail(400, 'Gunakan maksimal 6 bahan, masing-masing maksimal 40 karakter.');
    for (const ingredient of ingredients) {
      clauses.push("r.ingredients LIKE ? ESCAPE '='");
      params.push('%' + ingredient.replace(/[=%_]/g, (c) => '=' + c) + '%');
    }
    if (query.maxMinutes) {
      clauses.push('r.minutes <= ?');
      params.push(query.maxMinutes);
    }
    if (query.region) {
      clauses.push('r.region=?');
      params.push(query.region);
    }
    if (query.scope === 'mine') {
      clauses.push('r.author_id=?');
      params.push(req.user.id);
    }
    if (query.scope === 'saved') {
      clauses.push('EXISTS(SELECT 1 FROM bookmarks b WHERE b.recipe_id=r.id AND b.user_id=?)');
      params.push(req.user.id);
    }
    const rows = await db.all(
      select +
        (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') +
        ' ORDER BY ' +
        (query.sort === 'popular' ? 'like_count DESC, ' : '') +
        'r.created_at DESC,r.id DESC LIMIT 100',
      ...params,
    );
    res.json({ recipes: rows.map(serialize) });
  });
  app.get('/api/recipes/:id', async (req, res) =>
    res.json({ recipe: await recipe(req.params.id, req.user?.id) }),
  );
  registerReviews(app, { db, auth, recipe, ownedImage });
  app.post('/api/recipes', auth, async (req, res) => {
    const d = parse(recipeSchema, req.body);
    if (!(await ownedImage(d.image, req.user.id)))
      fail(400, 'Unggah foto resepmu terlebih dahulu.');
    if (d.video && !(await ownedVideo(d.video, req.user.id)))
      fail(400, 'Gunakan video yang kamu unggah sendiri.');
    const result = await db.run(
      'INSERT INTO recipes(author_id,title,description,region,image,minutes,servings,ingredients,steps,video) VALUES(?,?,?,?,?,?,?,?,?,?)',
      req.user.id,
      d.title,
      d.description,
      d.region,
      d.image,
      d.minutes,
      d.servings,
      JSON.stringify(d.ingredients),
      JSON.stringify(d.steps),
      d.video || '',
    );
    res.status(201).json({ recipe: await recipe(result.insertId, req.user.id) });
  });
  app.put('/api/recipes/:id', auth, async (req, res) => {
    const old = await recipe(req.params.id, req.user.id);
    if (old.author_id !== req.user.id) fail(403, 'Hanya pemilik yang dapat mengubah resep ini.');
    const d = parse(recipeSchema, req.body);
    if (d.image !== old.image && !(await ownedImage(d.image, req.user.id)))
      fail(400, 'Gunakan foto yang kamu unggah sendiri.');
    const video = d.video ?? old.video;
    if (video && !(await ownedVideo(video, req.user.id)))
      fail(400, 'Gunakan video yang kamu unggah sendiri.');
    await db.run(
      'UPDATE recipes SET title=?,description=?,region=?,image=?,minutes=?,servings=?,ingredients=?,steps=?,video=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?',
      d.title,
      d.description,
      d.region,
      d.image,
      d.minutes,
      d.servings,
      JSON.stringify(d.ingredients),
      JSON.stringify(d.steps),
      video,
      old.id,
    );
    res.json({ recipe: await recipe(old.id, req.user.id) });
  });
  app.delete('/api/recipes/:id', auth, async (req, res) => {
    const old = await recipe(req.params.id, req.user.id);
    if (old.author_id !== req.user.id) fail(403, 'Hanya pemilik yang dapat menghapus resep ini.');
    await db.run('DELETE FROM recipes WHERE id=?', old.id);
    res.json({ ok: true });
  });
  for (const [endpoint, table] of [
    ['like', 'likes'],
    ['bookmark', 'bookmarks'],
  ])
    app.put('/api/recipes/:id/' + endpoint, auth, async (req, res) => {
      const { active } = parse(z.object({ active: z.boolean() }), req.body),
        old = await recipe(req.params.id, req.user.id);
      await db.transaction(async (tx) => {
        if (active) {
          // Table is selected only from the fixed list above, never from user input.
          const result = await tx.run(
            `INSERT IGNORE INTO ${table}(user_id,recipe_id) VALUES(?,?)`,
            req.user.id,
            old.id,
          );
          if (endpoint === 'like' && result.affectedRows && old.author_id !== req.user.id)
            await tx.run(
              'INSERT INTO notifications(user_id,actor_id,recipe_id,message) VALUES(?,?,?,?)',
              old.author_id,
              req.user.id,
              old.id,
              `${req.user.name} menyukai resep ${old.title}.`,
            );
        } else
          await tx.run(`DELETE FROM ${table} WHERE user_id=? AND recipe_id=?`, req.user.id, old.id);
      });
      res.json({ recipe: await recipe(old.id, req.user.id) });
    });
  app.get('/api/recipes/:id/comments', async (req, res) => {
    await recipe(req.params.id);
    res.json({
      comments: await db.all(
        'SELECT c.id,c.body,c.created_at,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.recipe_id=? ORDER BY c.id DESC LIMIT 100',
        req.params.id,
      ),
    });
  });
  app.post('/api/recipes/:id/comments', auth, async (req, res) => {
    const { body } = parse(z.object({ body: z.string().trim().min(2).max(1200) }), req.body),
      r = await recipe(req.params.id);
    await db.transaction(async (tx) => {
      await tx.run(
        'INSERT INTO comments(user_id,recipe_id,body) VALUES(?,?,?)',
        req.user.id,
        r.id,
        body,
      );
      if (r.author_id !== req.user.id)
        await tx.run(
          'INSERT INTO notifications(user_id,actor_id,recipe_id,message) VALUES(?,?,?,?)',
          r.author_id,
          req.user.id,
          r.id,
          `${req.user.name} mengomentari resep ${r.title}.`,
        );
    });
    res.status(201).json({ ok: true });
  });
  app.get('/api/notifications', auth, async (req, res) =>
    res.json({
      notifications: await db.all(
        'SELECT id,message,recipe_id,seen,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50',
        req.user.id,
      ),
    }),
  );
  app.patch('/api/notifications/read', auth, async (req, res) => {
    await db.run('UPDATE notifications SET seen=1 WHERE user_id=?', req.user.id);
    res.json({ ok: true });
  });
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  });
  const uploadLimit = rateLimit({
    windowMs: 60_000,
    limit: 12,
    skip: () => skipLimits,
    message: { error: 'Tunggu sebentar sebelum mengunggah foto lagi.' },
  });
  app.post('/api/uploads', auth, uploadLimit, receive.single('image'), async (req, res) => {
    if (!req.file) fail(400, 'Pilih foto untuk diunggah.');
    let output;
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 25_000_000 }),
        meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format) || meta.pages > 1)
        fail(400, 'Gunakan foto JPG, PNG, atau WebP.');
      output = await image
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      fail(400, 'Foto tidak valid. Gunakan JPG, PNG, atau WebP maksimal 5 MB.');
    }
    const name = randomUUID() + '.webp',
      path = '/uploads/' + name;
    await writeFile(resolve(uploadDir, name), output);
    try {
      await db.run('INSERT INTO uploads(path,user_id) VALUES(?,?)', path, req.user.id);
    } catch (error) {
      await unlink(resolve(uploadDir, name));
      throw error;
    }
    res.status(201).json({ path });
  });
  registerVideoUploads(app, { db, root, auth, skipLimits });
  app.use(
    '/uploads',
    express.static(uploadDir, {
      dotfiles: 'deny',
      immutable: true,
      maxAge: '1y',
      setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
    }),
  );
  app.use('/api', (req, res) => res.status(404).json({ error: 'Alamat API tidak ditemukan.' }));
  app.use((error, req, res, next) => {
    const status =
      error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : error instanceof multer.MulterError
          ? 400
          : error.status || 500;
    if (status >= 500) console.error('Request failed:', error.message);
    res.status(status).json({
      error:
        status === 413
          ? 'Foto maksimal 5 MB.'
          : status === 503
            ? error.message
            : status < 500
              ? error.message
              : 'Ada kendala pada server. Silakan coba lagi.',
    });
  });
  return app;
}
