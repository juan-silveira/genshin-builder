// Dados de cada usuário no SQLite. Os cookies da HoYoLAB ficam cifrados (AES-256-GCM) com APP_SECRET.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { Account } from '../../shared/types'
import { getDoc, putDoc } from './db'
import type { HoyolabCookies } from './hoyolab'

export interface Config { uid?: string; cookies?: HoyolabCookies }
export interface Cache { account: Account; nextFetchAt: number }

interface StoredConfig { uid?: string; cookies?: string }

const SECRET = process.env.APP_SECRET
if (!SECRET && process.env.NODE_ENV === 'production') throw new Error('Defina APP_SECRET (chave para cifrar os cookies).')
const KEY = createHash('sha256').update(SECRET ?? 'dev-local-apenas').digest()

function encrypt(value: unknown): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', KEY, iv)
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.')
}

function decrypt<T>(blob: string): T | undefined {
  try {
    const [, iv, tag, data] = blob.split('.')
    const d = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'))
    d.setAuthTag(Buffer.from(tag, 'base64'))
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'))
  } catch {
    return undefined // chave trocada ou dado corrompido: trata como sem cookies
  }
}

export function loadConfig(userId: string): Config {
  const s = getDoc<StoredConfig>(userId, 'config') ?? {}
  return { uid: s.uid, cookies: s.cookies ? decrypt<HoyolabCookies>(s.cookies) : undefined }
}

export function saveConfig(userId: string, c: Config) {
  putDoc(userId, 'config', { uid: c.uid, cookies: c.cookies ? encrypt(c.cookies) : undefined } satisfies StoredConfig)
}

export const loadCache = (userId: string) => getDoc<Cache>(userId, 'cache')
export const saveCache = (userId: string, c: Cache) => putDoc(userId, 'cache', c)

// contador de desejos (formato e validação em shared/wishes.ts)
export const loadWishesRaw = (userId: string) => getDoc<unknown>(userId, 'wishes')
export const saveWishes = (userId: string, w: unknown) => putDoc(userId, 'wishes', w)
