import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { fail } from './validation.js';

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function inspectVideo(path) {
  const worker = new Worker(new URL('./video-worker.js', import.meta.url), {
    workerData: { path },
    execArgv: [],
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error('Video terlalu rumit untuk diperiksa. Ekspor ulang video dan coba lagi.'),
          ),
        20_000,
      );
      worker.once('message', (data) =>
        data.error ? reject(new Error(data.error)) : resolve(data),
      );
      worker.once('error', () =>
        reject(new Error('Video tidak dapat diperiksa. Pilih video lain.')),
      );
      worker.once('exit', (code) => {
        if (code !== 0) reject(new Error('Video tidak dapat diperiksa. Pilih video lain.'));
      });
    });
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

export function registerVideoUploads(app, { db, root, auth, skipLimits }) {
  const temporary = resolve(root, 'data/upload-tmp'),
    uploads = resolve(root, 'uploads');
  mkdirSync(temporary, { recursive: true });
  const receive = multer({
    storage: multer.diskStorage({
      destination: temporary,
      filename: (req, file, cb) => cb(null, randomUUID() + '.tmp'),
    }),
    limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 0, parts: 1 },
  }).single('video');
  const limit = rateLimit({
    windowMs: 60_000,
    limit: 6,
    skip: () => skipLimits,
    message: { error: 'Tunggu sebentar sebelum mengunggah video lagi.' },
  });
  let active = 0;
  app.post(
    '/api/uploads/video',
    auth,
    limit,
    (req, res, next) => {
      if (active >= 2)
        return res.status(429).json({ error: 'Unggahan video sedang penuh. Coba sebentar lagi.' });
      active++;
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          active--;
        }
      };
      res.once('close', release);
      res.once('finish', release);
      receive(req, res, (error) => {
        if (error)
          return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
            error:
              error.code === 'LIMIT_FILE_SIZE'
                ? 'Video maksimal 50 MB.'
                : 'Unggah satu berkas video MP4 atau WebM.',
          });
        next();
      });
    },
    async (req, res) => {
      if (!req.file) fail(400, 'Pilih video untuk diunggah.');
      let destination;
      try {
        let metadata;
        try {
          metadata = await inspectVideo(req.file.path);
        } catch (error) {
          fail(400, error.message);
        }
        if (req.aborted || res.destroyed) return;
        const name = randomUUID() + '.' + metadata.extension,
          path = '/uploads/' + name;
        destination = resolve(uploads, name);
        await rename(req.file.path, destination);
        await db.run(
          "INSERT INTO uploads(path,user_id,kind) VALUES(?,?,'video')",
          path,
          req.user.id,
        );
        destination = null;
        res.status(201).json({ path, duration: metadata.duration });
      } finally {
        await unlink(req.file.path).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
        if (destination)
          await unlink(destination).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
          });
      }
    },
  );
}
