import mysql from 'mysql2/promise';
import { databaseConfig, databaseIdentifier, openDatabase } from './db.js';
import { seed } from './seed.js';

const config = databaseConfig();
let connection, db;
try {
  connection = await mysql.createConnection({ ...config, database: undefined });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${databaseIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  db = await openDatabase();
  await db.initialize();
  await seed(db);
  console.log(`Database ${config.database} siap. Jalankan npm run dev untuk membuka Nusa Rasa.`);
} catch (error) {
  console.error(
    `Database belum siap (${error.code || 'error'}). Nyalakan MySQL di XAMPP dan periksa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, serta DB_NAME di .env.`,
  );
  process.exitCode = 1;
} finally {
  await db?.close();
  await connection?.end();
}
