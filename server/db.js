import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';

export function databaseConfig(overrides = {}) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nusa_rasa',
    charset: 'utf8mb4',
    timezone: 'Z',
    ...overrides,
  };
}

export function databaseIdentifier(name) {
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(name))
    throw new Error('Nama database hanya boleh berisi huruf, angka, dan garis bawah.');
  return '`' + name + '`';
}

function queries(connection) {
  return {
    async get(sql, ...params) {
      const [rows] = await connection.execute(sql, params);
      return rows[0];
    },
    async all(sql, ...params) {
      const [rows] = await connection.execute(sql, params);
      return rows;
    },
    async run(sql, ...params) {
      const [result] = await connection.execute(sql, params);
      return result;
    },
  };
}

export async function openDatabase(overrides = {}) {
  const pool = mysql.createPool({
    ...databaseConfig(overrides),
    connectionLimit: 10,
    waitForConnections: true,
  });
  // All dates in the API are UTC, regardless of the XAMPP computer's timezone.
  pool.on('connection', (connection) => connection.query("SET time_zone = '+00:00'"));
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    ...queries(pool),
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await work(queries(connection));
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async initialize() {
      const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
      for (const statement of schema
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await pool.query(statement);
    },
    close: () => pool.end(),
  };
}
