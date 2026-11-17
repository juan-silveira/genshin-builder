// Banco SQLite (node:sqlite, sem dependências). Guarda usuários, sessões e os dados de cada um.
// Não há e-mail, nome real nem foto: só um nome de usuário escolhido pela pessoa.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { STATE } from './paths'

mkdirSync(STATE, { recursive: true, mode: 0o700 })
export const db = new DatabaseSync(process.env.DB_PATH ?? join(STATE, 'genshin.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash   TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );

  -- um documento JSON por (usuário, chave): config, cache, wishes
  CREATE TABLE IF NOT EXISTS user_data (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    json        TEXT NOT NULL,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
`)

// migração: código de recuperação de senha (hash), sem e-mail
const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name)
if (!userCols.includes('recovery_hash')) db.exec('ALTER TABLE users ADD COLUMN recovery_hash TEXT')

const getStmt = db.prepare('SELECT json FROM user_data WHERE user_id = ? AND key = ?')
const putStmt = db.prepare(`
  INSERT INTO user_data (user_id, key, json, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (user_id, key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
`)

export function getDoc<T>(userId: string, key: string): T | undefined {
  const row = getStmt.get(userId, key) as { json: string } | undefined
  return row ? JSON.parse(row.json) : undefined
}

export function putDoc(userId: string, key: string, value: unknown) {
  putStmt.run(userId, key, JSON.stringify(value), Date.now())
}
