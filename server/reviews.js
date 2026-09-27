import { z } from 'zod';
import { parse, fail } from './validation.js';

export function registerReviews(app, { db, auth, recipe, ownedImage }) {
  const selection = `SELECT v.user_id,v.rating,v.body,v.image,v.created_at,v.updated_at,
    u.name,u.avatar FROM reviews v JOIN users u ON u.id=v.user_id`;
  app.get('/api/recipes/:id/reviews', async (req, res) => {
    const r = await recipe(req.params.id, req.user?.id);
    const reviews = await db.all(
      selection + ' WHERE v.recipe_id=? ORDER BY v.updated_at DESC,v.user_id DESC LIMIT 50',
      r.id,
    );
    const mine = req.user
      ? await db.get(selection + ' WHERE v.recipe_id=? AND v.user_id=?', r.id, req.user.id)
      : null;
    res.json({ reviews, mine: mine || null, count: r.review_count, average: r.rating_average });
  });
  app.put('/api/recipes/:id/review', auth, async (req, res) => {
    const d = parse(
      z.object({
        rating: z.number().int().min(1).max(5),
        body: z.string().trim().min(2).max(1200),
        image: z.string().max(180).default(''),
      }),
      req.body,
    );
    const r = await recipe(req.params.id);
    if (r.author_id === req.user.id) fail(403, 'Ulasan diberikan oleh orang yang mencoba resepmu.');
    if (d.image && !(await ownedImage(d.image, req.user.id)))
      fail(400, 'Gunakan foto hasil masakan yang kamu unggah sendiri.');
    await db.transaction(async (tx) => {
      // Lock the recipe so simultaneous saves create only one review notification.
      const current = await tx.get('SELECT id FROM recipes WHERE id=? FOR UPDATE', r.id);
      if (!current) fail(404, 'Resep tidak ditemukan.');
      const existing = await tx.get(
        'SELECT user_id FROM reviews WHERE recipe_id=? AND user_id=?',
        r.id,
        req.user.id,
      );
      await tx.run(
        `INSERT INTO reviews(recipe_id,user_id,rating,body,image) VALUES(?,?,?,?,?)
        ON DUPLICATE KEY UPDATE rating=VALUES(rating),body=VALUES(body),image=VALUES(image),updated_at=CURRENT_TIMESTAMP(3)`,
        r.id,
        req.user.id,
        d.rating,
        d.body,
        d.image,
      );
      if (!existing)
        await tx.run(
          'INSERT INTO notifications(user_id,actor_id,recipe_id,message) VALUES(?,?,?,?)',
          r.author_id,
          req.user.id,
          r.id,
          `${req.user.name} membagikan ulasan untuk ${r.title}.`,
        );
    });
    res.json({ recipe: await recipe(r.id, req.user.id) });
  });
  app.delete('/api/recipes/:id/review', auth, async (req, res) => {
    const r = await recipe(req.params.id);
    await db.run('DELETE FROM reviews WHERE recipe_id=? AND user_id=?', r.id, req.user.id);
    res.json({ recipe: await recipe(r.id, req.user.id) });
  });
}
