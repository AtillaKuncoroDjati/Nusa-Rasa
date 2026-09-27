// Each migration checks individual columns so retrying interrupted MySQL DDL is safe.
export async function migrate(db) {
  await db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(80) PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB`);
  const version = '001_recipe_video';
  if (await db.get('SELECT version FROM schema_migrations WHERE version=?', version)) return;
  const hasColumn = async (table, column) =>
    Boolean(
      await db.get(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
        table,
        column,
      ),
    );
  if (!(await hasColumn('recipes', 'video')))
    await db.run(
      "ALTER TABLE recipes ADD COLUMN video VARCHAR(255) NOT NULL DEFAULT '' AFTER image",
    );
  if (!(await hasColumn('uploads', 'kind')))
    await db.run("ALTER TABLE uploads ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'image'");
  await db.run('INSERT INTO schema_migrations(version) VALUES(?)', version);
}
