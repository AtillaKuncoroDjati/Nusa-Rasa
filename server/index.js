import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4180),
  host = process.env.HOST || '127.0.0.1';
const origin = process.env.APP_ORIGIN || `http://${host}:${port}`;
const dev = process.argv.includes('--dev'),
  production = process.env.NODE_ENV === 'production';
if (production && (!process.env.APP_ORIGIN || !origin.startsWith('https://')))
  throw new Error('Production requires an explicit HTTPS APP_ORIGIN.');
let db;
try {
  db = await openDatabase();
  await db.get('SELECT id FROM users LIMIT 1');
  await db.get('SELECT video FROM recipes LIMIT 1');
  await db.get('SELECT kind FROM uploads LIMIT 1');
  await db.get('SELECT rating FROM reviews LIMIT 1');
} catch (error) {
  await db?.close();
  console.error(
    `Database belum siap (${error.code || 'error'}). Nyalakan MySQL di XAMPP, periksa .env, lalu jalankan npm run db:setup.`,
  );
  process.exit(1);
}
const app = createApp({ db, root, origin, production });
if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dir = resolve(root, 'dist');
  if (!existsSync(resolve(dir, 'index.html')))
    throw new Error('Run npm run build before npm start.');
  app.use(express.static(dir));
  app.get('/{*path}', (req, res) => res.sendFile(resolve(dir, 'index.html')));
}
const server = app.listen(port, host, () => console.log(`Nusa Rasa: ${origin}`));
function close() {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
