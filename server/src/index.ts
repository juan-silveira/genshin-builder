import express, { type Request } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Account } from '../../shared/types'
import type { AbyssView, AppState, DailyNote, TeamCheckState } from '../../shared/view-types'
import { analyzeAccount } from './analysis'
import { registerAuthRoutes, requireJson, requireUser } from './auth'
import { fetchEnka } from './enka'
import { loadGuides } from './guides'
import { fetchDailyNote, fetchHoyolab, fetchSpiralAbyss } from './hoyolab'
import { checkTeam } from './teamcheck'
import { HoyolabLoginError, loginHoyolab } from './hoyolab-auth'
import { randomUUID } from 'node:crypto'
import { optimizeTeams } from './optimizer'
import { DIST } from './paths'
import { loadCache, loadConfig, saveCache, saveConfig } from './storage'
import { buildToday } from './today'
import { activeCodes } from './codes'
import { materialMap } from './farm'
import { buildWeapons } from './weapons'
import { buildArtifacts } from './artifacts'
import { getDoc, putDoc } from './db'
import { registerWishRoutes } from './wishes'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '0.0.0.0'
// o login pela janela do Chrome só faz sentido no PC (no Raspberry não há tela)
const BROWSER_LOGIN = process.env.BROWSER_LOGIN === '1'
// intervalo mínimo entre atualizações da conta pela HoYoLAB, por pessoa
const HOYOLAB_MIN_INTERVAL = 60_000

const app = express()
app.set('trust proxy', 'loopback')
app.disable('x-powered-by')
app.use(express.json({ limit: '50kb' }))
app.use('/api', requireJson)

// versão publicada (a interface compara com a dela para saber se está desatualizada)
app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8')
    res.json({ version: html.match(/data-version="([^"]+)"/)?.[1] ?? null })
  } catch {
    res.json({ version: null })
  }
})

registerAuthRoutes(app)
app.use('/api', (req, res, next) => (req.path.startsWith('/auth/') ? next() : requireUser(req, res, next)))

const uidOf = (req: Request) => req.userId!

const state = (userId: string, username?: string): AppState => {
  const cfg = loadConfig(userId)
  const cache = loadCache(userId)
  // guias são relidos a cada pedido para que edições nos JSON apareçam sem reiniciar
  const { guides, teams } = loadGuides()
  return {
    username,
    uid: cfg.uid,
    hasCookies: !!cfg.cookies,
    browserLogin: BROWSER_LOGIN,
    view: cache && cache.account.uid === cfg.uid ? analyzeAccount(cache.account, guides, teams) : undefined,
  }
}

app.get('/api/state', (req, res) => {
  res.json(state(uidOf(req), req.username))
})

app.post('/api/config', (req, res) => {
  const { uid, ltuid, ltoken, ltmid } = req.body ?? {}
  const cfg = loadConfig(uidOf(req))
  if (uid !== undefined) {
    if (!/^\d{9,10}$/.test(String(uid))) return res.status(400).json({ error: 'UID deve ter 9 ou 10 dígitos.' })
    cfg.uid = String(uid)
  }
  if (ltuid && ltoken) {
    cfg.cookies = { ltuid: String(ltuid).trim(), ltoken: String(ltoken).trim(), ltmid: ltmid ? String(ltmid).trim() : undefined }
  }
  saveConfig(uidOf(req), cfg)
  res.json(state(uidOf(req), req.username))
})

// Login na HoYoLAB com e-mail e senha (endpoint oficial). A senha não é salva; só os cookies de leitura.
const hoyoAttempts = new Map<string, { n: number; until: number }>()
app.post('/api/hoyolab/login', async (req, res) => {
  const userId = uidOf(req)
  const a = hoyoAttempts.get(userId)
  if (a && a.n >= 8 && Date.now() < a.until) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' })
  const fresh = !a || Date.now() > a.until
  hoyoAttempts.set(userId, { n: fresh ? 1 : a!.n + 1, until: fresh ? Date.now() + 15 * 60_000 : a!.until })

  const { email, password, captcha } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Informe o e-mail e a senha da HoYoverse.' })
  // o mesmo "dispositivo" em todas as tentativas da pessoa (a HoYoverse reconhece logins repetidos)
  let deviceId = getDoc<string>(userId, 'hoyo-device')
  if (!deviceId) { deviceId = randomUUID(); putDoc(userId, 'hoyo-device', deviceId) }
  try {
    const result = await loginHoyolab(String(email), String(password), deviceId, captcha)
    if (!result.ok) return res.json({ captcha: result.captcha })
    const cfg = loadConfig(userId)
    cfg.cookies = result.cookies
    // descobre o UID do Genshin da conta, se ainda não houver
    if (!cfg.uid) cfg.uid = (await findGenshinUid(result.cookies).catch(() => undefined)) ?? cfg.uid
    saveConfig(userId, cfg)
    hoyoAttempts.delete(userId)
    res.json({ state: state(userId, req.username) })
  } catch (e: any) {
    res.status(e instanceof HoyolabLoginError ? 400 : 502).json({ error: e.message ?? 'Falha no login da HoYoLAB.' })
  }
})

/** contas de jogo vinculadas à conta HoYoLAB → UID do Genshin (o de maior nível) */
async function findGenshinUid(c: { ltuid: string; ltoken: string; ltmid?: string }) {
  const res = await fetch('https://api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie?game_biz=hk4e_global', {
    headers: { Cookie: `ltuid_v2=${c.ltuid}; ltoken_v2=${c.ltoken}${c.ltmid ? `; ltmid_v2=${c.ltmid}` : ''}` },
    signal: AbortSignal.timeout(10_000),
  })
  const list: any[] = (await res.json())?.data?.list ?? []
  return list.sort((x, y) => (y.level ?? 0) - (x.level ?? 0))[0]?.game_uid as string | undefined
}

// Abre o Chrome NESTE computador no hoyolab.com e espera o login para guardar os cookies.
app.post('/api/hoyolab-login', async (req, res) => {
  if (!BROWSER_LOGIN) return res.status(404).json({ error: 'Login pelo navegador só funciona no app rodando no PC.' })
  try {
    const { loginWithBrowser } = await import('./hoyolab-login')
    const cookies = await loginWithBrowser()
    const cfg = loadConfig(uidOf(req))
    cfg.cookies = cookies
    saveConfig(uidOf(req), cfg)
    res.json(state(uidOf(req), req.username))
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/cookies', (req, res) => {
  const cfg = loadConfig(uidOf(req))
  delete cfg.cookies
  saveConfig(uidOf(req), cfg)
  res.json(state(uidOf(req), req.username))
})

app.post('/api/refresh', async (req, res) => {
  const userId = uidOf(req)
  const cfg = loadConfig(userId)
  if (!cfg.uid) return res.status(400).json({ error: 'Informe o UID primeiro.' })
  const cache = loadCache(userId)
  if (cache && cache.account.uid === cfg.uid && Date.now() < cache.nextFetchAt) {
    const wait = Math.ceil((cache.nextFetchAt - Date.now()) / 1000)
    return res.status(429).json({ error: `Atualizado agora há pouco. Tente de novo em ${wait}s.` })
  }

  try {
    let account: Account
    let nextFetchAt = Date.now() + HOYOLAB_MIN_INTERVAL
    if (cfg.cookies) {
      try {
        account = await fetchHoyolab(cfg.uid, cfg.cookies)
        // nome e nível vêm do Enka (só o perfil, sem personagens); falha aqui não é problema
        const enka = await fetchEnka(cfg.uid).catch(() => undefined)
        if (enka) Object.assign(account, { nickname: enka.nickname, level: enka.level, worldLevel: enka.worldLevel })
      } catch (e: any) {
        account = await fetchEnka(cfg.uid)
        account.warnings.unshift(`HoYoLAB falhou (${e.message}) — mostrando só a Vitrine do Enka.`)
      }
    } else {
      const enka = await fetchEnka(cfg.uid)
      nextFetchAt = Date.now() + Math.max(enka.ttl * 1000, HOYOLAB_MIN_INTERVAL)
      const { ttl: _ttl, ...rest } = enka
      account = rest
    }
    saveCache(userId, { account, nextFetchAt })
    res.json(state(userId, req.username))
  } catch (e: any) {
    res.status(502).json({ error: e.message ?? 'Falha ao buscar dados.' })
  }
})

// Sugere trocas de artefatos/armas entre personagens para uma ou mais equipes (nomes de TeamView).
app.post('/api/optimize', (req, res) => {
  const names: string[] = Array.isArray(req.body?.teams) ? req.body.teams.slice(0, 2) : []
  const cfg = loadConfig(uidOf(req))
  const cache = loadCache(uidOf(req))
  if (!cache || cache.account.uid !== cfg.uid) return res.status(400).json({ error: 'Carregue a conta primeiro.' })
  const { guides, teams } = loadGuides()
  const view = analyzeAccount(cache.account, guides, teams)
  const chosen = names.map((n) => view.teams.find((t) => t.name === n)).filter((t) => !!t)
  if (!chosen.length) return res.status(404).json({ error: 'Equipe não encontrada.' })
  const power = new Map(view.characters.map((c) => [c.id, c.power]))
  // carries escolhem primeiro; depois os outros, do mais forte ao mais fraco
  const carries = chosen.map((t) => t.carryId)
  const others = [...new Set(chosen.flatMap((t) => t.members.filter((m) => m.owned).map((m) => m.id)))]
    .filter((id) => !carries.includes(id))
    .sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0))
  res.json(optimizeTeams(cache.account, guides, [...carries, ...others]))
})

// Notas em Tempo Real ficam 5 min em memória (por pessoa) para não consultar a HoYoLAB a cada toque.
const noteCache = new Map<string, { uid: string; at: number; note?: DailyNote; error?: string }>()

app.get('/api/today', async (req, res) => {
  const userId = uidOf(req)
  const cfg = loadConfig(userId)
  const cache = loadCache(userId)
  if (!cache || cache.account.uid !== cfg.uid) return res.status(400).json({ error: 'Carregue a conta primeiro.' })
  const { guides, teams } = loadGuides()
  const view = analyzeAccount(cache.account, guides, teams)

  let entry = noteCache.get(userId)
  const stale = !entry || entry.uid !== cfg.uid || Date.now() - entry.at > 5 * 60_000
  // "atualizar" força a consulta, mas no máximo uma vez por minuto
  const forced = req.query.atualizar === '1' && (!entry || Date.now() - entry.at > 60_000)
  if (cfg.cookies && cfg.uid && (stale || forced)) {
    try {
      entry = { uid: cfg.uid, at: Date.now(), note: await fetchDailyNote(cfg.uid, cfg.cookies) }
    } catch (e: any) {
      entry = { uid: cfg.uid, at: Date.now(), error: e.message }
    }
    noteCache.set(userId, entry)
  }
  const noCookies = 'Conecte a HoYoLAB na aba Conta para ver resina, comissões e expedições.'
  res.json(buildToday(view, cfg.cookies ? entry?.note : undefined, cfg.cookies ? entry?.error : noCookies))
})

app.get('/api/weapons', (req, res) => {
  const cfg = loadConfig(uidOf(req))
  const cache = loadCache(uidOf(req))
  if (!cache || cache.account.uid !== cfg.uid) return res.status(400).json({ error: 'Carregue a conta primeiro.' })
  const { guides, teams } = loadGuides()
  res.json(buildWeapons(cache.account, analyzeAccount(cache.account, guides, teams), guides))
})

app.get('/api/artifacts', (req, res) => {
  const cfg = loadConfig(uidOf(req))
  const cache = loadCache(uidOf(req))
  if (!cache || cache.account.uid !== cfg.uid) return res.status(400).json({ error: 'Carregue a conta primeiro.' })
  const { guides, teams } = loadGuides()
  res.json(buildArtifacts(cache.account, analyzeAccount(cache.account, guides, teams), guides))
})

// Analisador de equipe: GET devolve o último time salvo (e os times do Abismo atual); POST analisa e salva.
const abyssCache = new Map<string, { at: number; abyss?: AbyssView; error?: string }>()

app.get('/api/team-check', async (req, res) => {
  const userId = uidOf(req)
  const cfg = loadConfig(userId)
  const cache = loadCache(userId)
  if (!cache || cache.account.uid !== cfg.uid) return res.status(400).json({ error: 'Carregue a conta primeiro.' })
  const { guides, teams } = loadGuides()
  const view = analyzeAccount(cache.account, guides, teams)
  const saved = getDoc<string[]>(userId, 'my-team')
  const out: TeamCheckState = { saved, check: saved?.length ? checkTeam(view, saved, teams) : undefined }
  if (cfg.cookies && cfg.uid) {
    let entry = abyssCache.get(userId)
    if (!entry || Date.now() - entry.at > 10 * 60_000) {
      try { entry = { at: Date.now(), abyss: await fetchSpiralAbyss(cfg.uid, cfg.cookies) } }
      catch (e: any) { entry = { at: Date.now(), error: e.message } }
      abyssCache.set(userId, entry)
    }
    out.abyss = entry.abyss
    out.abyssError = entry.error
  }
  res.json(out)
})

app.post('/api/team-check', (req, res) => {
  const userId = uidOf(req)
  const ids: unknown = req.body?.ids
  if (!Array.isArray(ids) || ids.length > 4 || !ids.every((x) => typeof x === 'string')) {
    return res.status(400).json({ error: 'Escolha até 4 personagens.' })
  }
  const cfg = loadConfig(userId)
  const cache = loadCache(userId)
  if (!cache || cache.account.uid !== cfg.uid) return res.status(400).json({ error: 'Carregue a conta primeiro.' })
  const { guides, teams } = loadGuides()
  const view = analyzeAccount(cache.account, guides, teams)
  const valid = (ids as string[]).filter((id) => view.characters.some((c) => c.id === id))
  putDoc(userId, 'my-team', valid)
  res.json({ saved: valid, check: checkTeam(view, valid, teams) } satisfies TeamCheckState)
})

app.get('/api/map/:id', (req, res) => {
  const data = materialMap(String(req.params.id), getDoc<Record<string, number>>(uidOf(req), 'map-marks') ?? {})
  if (!data) return res.status(404).json({ error: 'Esse material não tem pontos no mapa.' })
  res.set('Cache-Control', 'private, no-cache').json(data)
})

// pontos coletados no mapa: { idDoPonto: quando coletou }. Guarda 7 dias no máximo (tudo já renasceu).
app.post('/api/map/marks', (req, res) => {
  const marks = getDoc<Record<string, number>>(uidOf(req), 'map-marks') ?? {}
  const week = Date.now() - 7 * 86_400_000
  for (const [k, t] of Object.entries(marks)) if (t < week) delete marks[k]
  const points: unknown = req.body?.points
  if (!Array.isArray(points) || points.length > 500 || !points.every((p) => Number.isInteger(p))) {
    return res.status(400).json({ error: 'Pontos inválidos.' })
  }
  for (const p of points as number[]) {
    if (req.body?.collected) marks[p] = Date.now()
    else delete marks[p]
  }
  if (Object.keys(marks).length > 20_000) return res.status(400).json({ error: 'Marcações demais.' })
  putDoc(uidOf(req), 'map-marks', marks)
  res.json({ ok: true })
})

// Códigos de resgate ativos + quais a pessoa já marcou como resgatados.
app.get('/api/codes', async (req, res) => {
  const { codes, error } = await activeCodes()
  const redeemed = new Set(getDoc<string[]>(uidOf(req), 'codes') ?? [])
  res.json({ codes: codes.map((c) => ({ ...c, redeemed: redeemed.has(c.code) })), error })
})

app.post('/api/codes', (req, res) => {
  const code = String(req.body?.code ?? '').toUpperCase()
  if (!/^[A-Z0-9]{6,20}$/.test(code)) return res.status(400).json({ error: 'Código inválido.' })
  const set = new Set(getDoc<string[]>(uidOf(req), 'codes') ?? [])
  if (req.body?.redeemed) set.add(code)
  else set.delete(code)
  // guarda só os últimos 200 para não crescer para sempre
  putDoc(uidOf(req), 'codes', [...set].slice(-200))
  res.json({ ok: true })
})

registerWishRoutes(app)

if (existsSync(DIST)) {
  // arquivos com hash no nome (assets/) podem ficar em cache para sempre; o resto (index.html, sw.js,
  // manifesto) precisa ser checado sempre, senão o celular e o Cloudflare seguram a versão antiga
  app.use(express.static(DIST, {
    index: false,
    setHeaders: (res, path) => {
      if (path.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      else res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    },
  }))
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(join(DIST, 'index.html'))
  })
}

app.listen(PORT, HOST, () => console.log(`Genshin Builder em http://localhost:${PORT}`))
