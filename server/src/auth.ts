// Login próprio: usuário + senha (scrypt), sessão em cookie HttpOnly. Criar conta exige o código de convite
// (INVITE_CODE), que a dona do app passa para quem quiser. Nada de e-mail ou dado pessoal.
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import type { Express, NextFunction, Request, Response } from 'express'
import { db } from './db'

const SESSION_DAYS = 90
const COOKIE = 'gb_session'
const INVITE_CODE = process.env.INVITE_CODE

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { userId?: string; username?: string } }
}

const scryptAsync = (pass: string, salt: Buffer) =>
  new Promise<Buffer>((ok, fail) => scrypt(pass, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k))))

async function hashPassword(pass: string) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${(await scryptAsync(pass, salt)).toString('base64')}`
}

async function verifyPassword(pass: string, stored: string) {
  const [, salt, hash] = stored.split('$')
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(pass, Buffer.from(salt, 'base64'))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** código de recuperação legível: 4 grupos de 4 (sem letras que confundem) */
function newRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(16)
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length])
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-')
}
const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')

async function setRecoveryCode(userId: string) {
  const code = newRecoveryCode()
  db.prepare('UPDATE users SET recovery_hash = ? WHERE id = ?').run(await hashPassword(normalizeCode(code)), userId)
  return code
}

// limite simples de tentativas por IP (o Cloudflare manda o IP real no cabeçalho)
const attempts = new Map<string, { n: number; until: number }>()
const clientIp = (req: Request) => String(req.headers['cf-connecting-ip'] ?? req.ip ?? '')
function tooMany(req: Request) {
  const a = attempts.get(clientIp(req))
  return !!a && a.n >= 8 && Date.now() < a.until
}
function countAttempt(req: Request) {
  const ip = clientIp(req)
  const a = attempts.get(ip)
  const fresh = !a || Date.now() > a.until
  attempts.set(ip, { n: fresh ? 1 : a!.n + 1, until: fresh ? Date.now() + 15 * 60_000 : a!.until })
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

function startSession(req: Request, res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expires = Date.now() + SESSION_DAYS * 86_400_000
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires)
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.headers['cf-visitor']?.toString().includes('https')
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`)
}

const USERNAME_RE = /^[a-z0-9_.-]{3,24}$/i

export function registerAuthRoutes(app: Express) {
  app.get('/api/auth/me', (req, res) => {
    const user = sessionUser(req)
    const hasRecovery = user
      ? !!(db.prepare('SELECT recovery_hash FROM users WHERE id = ?').get(user.id) as { recovery_hash: string | null }).recovery_hash
      : false
    res.json({ user: user ? { username: user.username, hasRecovery } : null, inviteRequired: !!INVITE_CODE })
  })

  app.post('/api/auth/signup', async (req, res) => {
    if (tooMany(req)) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' })
    const { username, password, invite } = req.body ?? {}
    if (INVITE_CODE && invite !== INVITE_CODE) {
      countAttempt(req)
      return res.status(403).json({ error: 'Código de convite inválido. Peça o código para quem te indicou o app.' })
    }
    if (!USERNAME_RE.test(String(username ?? ''))) {
      return res.status(400).json({ error: 'Usuário: 3 a 24 caracteres, só letras, números, ponto, hífen ou _.' })
    }
    if (String(password ?? '').length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' })
    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)
    if (exists) return res.status(409).json({ error: 'Esse usuário já existe. Escolha outro ou entre.' })
    const id = randomUUID()
    db.prepare('INSERT INTO users (id, username, pass_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username, await hashPassword(password), Date.now())
    const recoveryCode = await setRecoveryCode(id)
    startSession(req, res, id)
    // o código aparece uma única vez: é o único jeito de recuperar a senha sem e-mail
    res.json({ user: { username }, recoveryCode })
  })

  // esqueci a senha: usuário + código de recuperação → nova senha (e um código novo, pois o antigo foi usado)
  app.post('/api/auth/reset', async (req, res) => {
    if (tooMany(req)) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' })
    const { username, code, password } = req.body ?? {}
    const user = db.prepare('SELECT id, username, recovery_hash FROM users WHERE username = ?').get(String(username ?? '')) as
      | { id: string; username: string; recovery_hash: string | null } | undefined
    if (!user?.recovery_hash || !(await verifyPassword(normalizeCode(String(code ?? '')), user.recovery_hash))) {
      countAttempt(req)
      return res.status(401).json({ error: 'Usuário ou código de recuperação incorretos.' })
    }
    if (String(password ?? '').length < 8) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' })
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(await hashPassword(password), user.id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
    const recoveryCode = await setRecoveryCode(user.id)
    startSession(req, res, user.id)
    res.json({ user: { username: user.username }, recoveryCode })
  })

  // gera um código de recuperação novo (invalida o anterior); pede a senha atual
  app.post('/api/auth/recovery-code', requireUser, async (req, res) => {
    const user = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.userId!) as { pass_hash: string }
    if (!(await verifyPassword(String(req.body?.password ?? ''), user.pass_hash))) return res.status(401).json({ error: 'Senha incorreta.' })
    res.json({ recoveryCode: await setRecoveryCode(req.userId!) })
  })

  // código de convite para quem já tem conta passar adiante
  app.get('/api/auth/invite', requireUser, (_req, res) => {
    res.json({ invite: INVITE_CODE ?? null })
  })

  app.post('/api/auth/login', async (req, res) => {
    if (tooMany(req)) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' })
    const { username, password } = req.body ?? {}
    const user = db.prepare('SELECT id, username, pass_hash FROM users WHERE username = ?').get(String(username ?? '')) as
      | { id: string; username: string; pass_hash: string } | undefined
    if (!user || !(await verifyPassword(String(password ?? ''), user.pass_hash))) {
      countAttempt(req)
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' })
    }
    startSession(req, res, user.id)
    res.json({ user: { username: user.username } })
  })

  app.post('/api/auth/logout', (req, res) => {
    const token = readCookie(req, COOKIE)
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
    res.json({ user: null })
  })

  app.post('/api/auth/change-password', requireUser, async (req, res) => {
    const { current, next } = req.body ?? {}
    const user = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.userId!) as { pass_hash: string }
    if (!(await verifyPassword(String(current ?? ''), user.pass_hash))) return res.status(401).json({ error: 'Senha atual incorreta.' })
    if (String(next ?? '').length < 8) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' })
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(await hashPassword(next), req.userId!)
    // derruba as outras sessões e mantém esta
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId!)
    startSession(req, res, req.userId!)
    res.json({ ok: true })
  })

  // apaga a conta e todos os dados dela (usuário, sessões, configuração, cookies, desejos)
  app.post('/api/auth/delete-account', requireUser, async (req, res) => {
    const user = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.userId!) as { pass_hash: string }
    if (!(await verifyPassword(String(req.body?.password ?? ''), user.pass_hash))) {
      return res.status(401).json({ error: 'Senha incorreta.' })
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId!)
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
    res.json({ user: null })
  })
}

function sessionUser(req: Request) {
  const token = readCookie(req, COOKIE)
  if (!token) return undefined
  return db.prepare(`
    SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(sha256(token), Date.now()) as { id: string; username: string } | undefined
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = sessionUser(req)
  if (!user) return res.status(401).json({ error: 'Entre na sua conta.', auth: true })
  req.userId = user.id
  req.username = user.username
  next()
}

/** pedidos que mudam dados precisam ser JSON: formulários de outros sites não conseguem enviar isso */
export function requireJson(req: Request, res: Response, next: NextFunction) {
  // DELETE de outro site exige pré-verificação (CORS), então já está protegido
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') return next()
  if (!req.is('application/json')) return res.status(415).json({ error: 'Envie JSON.' })
  next()
}

/** cria um usuário direto no banco (usado pelo script de importação) */
export async function createUser(username: string, password: string) {
  const id = randomUUID()
  db.prepare('INSERT INTO users (id, username, pass_hash, created_at) VALUES (?, ?, ?, ?)').run(id, username, await hashPassword(password), Date.now())
  return id
}
