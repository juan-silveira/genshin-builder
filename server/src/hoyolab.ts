// Leitura do Diário de Batalha (Battle Chronicle) da HoYoLAB — SOMENTE LEITURA.
// Usa apenas os cookies de leitura (ltuid_v2 / ltoken_v2), os mesmos que o site da HoYoLAB usa
// para mostrar o perfil. Não acessa o cliente do jogo, não faz check-in nem resgata códigos.
// Endpoints e assinatura (DS) conforme o projeto open-source genshin.py.
import { createHash, randomInt } from 'node:crypto'
import type { Account, Artifact, Character } from '../../shared/types'
import type { AbyssView, DailyNote } from '../../shared/view-types'
import { characters, relicSetId, setByPt, setInfo, skillOrder } from './gamedata'
import { FINAL_PROPS, HOYOLAB_SLOTS, NUMERIC_PROPS, parseValue } from './props'

const BASE = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api'
const DS_SALT = '6s25p5ox5y14umn1p61aqyyvbvvl3lrt'

export interface HoyolabCookies { ltuid: string; ltoken: string; ltmid?: string }

export class HoyolabError extends Error {
  constructor(message: string, public retcode?: number) { super(message) }
}

const RETCODES: Record<number, string> = {
  [-100]: 'Cookies inválidos ou expirados. Faça login de novo na HoYoLAB e copie os cookies outra vez.',
  10001: 'Cookies inválidos ou expirados. Faça login de novo na HoYoLAB e copie os cookies outra vez.',
  10103: 'As Notas em Tempo Real estão desativadas. Na HoYoLAB: Diário de Batalha › Configurações › ative "Notas em Tempo Real".',
  10102: 'Os dados estão privados. Na HoYoLAB: Perfil › Diário de Batalha › Configurações › ative "Mostrar detalhes do personagem".',
  10101: 'Limite diário de consultas da HoYoLAB atingido. Tente amanhã.',
  1009: 'UID não encontrado ou não vinculado a esta conta da HoYoLAB.',
}

function serverOf(uid: string): string {
  const prefix = uid.slice(0, -8)
  if (prefix === '6') return 'os_usa'
  if (prefix === '7') return 'os_euro'
  if (prefix === '8' || prefix === '18') return 'os_asia'
  if (prefix === '9') return 'os_cht'
  throw new HoyolabError('A HoYoLAB só atende servidores globais (América, Europa, Ásia, TW/HK/MO).')
}

function ds(): string {
  const t = Math.floor(Date.now() / 1000)
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const r = Array.from({ length: 6 }, () => letters[randomInt(letters.length)]).join('')
  const h = createHash('md5').update(`salt=${DS_SALT}&t=${t}&r=${r}`).digest('hex')
  return `${t},${r},${h}`
}

async function request(method: 'GET' | 'POST', endpoint: string, body: Record<string, unknown>, c: HoyolabCookies) {
  const cookie = [`ltuid_v2=${c.ltuid}`, `ltoken_v2=${c.ltoken}`, c.ltmid && `ltmid_v2=${c.ltmid}`]
    .filter(Boolean)
    .join('; ')
  const url = method === 'GET'
    ? `${BASE}/${endpoint}?${new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]))}`
    : `${BASE}/${endpoint}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      DS: ds(),
      'x-rpc-app_version': '1.5.0',
      'x-rpc-client_type': '5',
      'x-rpc-language': 'pt-pt',
      Origin: 'https://act.hoyolab.com',
      Referer: 'https://act.hoyolab.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new HoyolabError(`HoYoLAB respondeu HTTP ${res.status}.`)
  const json = await res.json()
  if (json.retcode !== 0) {
    throw new HoyolabError(RETCODES[json.retcode] ?? `HoYoLAB: ${json.message} (código ${json.retcode})`, json.retcode)
  }
  return json.data
}

export async function fetchHoyolab(uid: string, cookies: HoyolabCookies): Promise<Account> {
  const server = serverOf(uid)
  const list = await request('POST', 'character/list', { role_id: uid, server }, cookies)
  const ids: number[] = (list.list ?? []).map((c: any) => c.id)
  const detail = ids.length
    ? await request('POST', 'character/detail', { role_id: uid, server, character_ids: ids }, cookies)
    : { list: [] }

  return {
    uid,
    nickname: uid,
    source: 'hoyolab',
    fetchedAt: new Date().toISOString(),
    characters: (detail.list ?? []).map(normalize).filter((c: Character | undefined): c is Character => !!c),
    warnings: [],
  }
}

function resolveId(base: any): string | undefined {
  const id = String(base.id)
  if (characters.has(id)) return id
  // Viajante: um id por elemento ("10000007-704"); a HoYoLAB devolve o elemento em inglês
  for (const c of characters.values()) {
    if (c.id.startsWith(`${id}-`) && c.element === base.element) return c.id
  }
  return undefined
}

function normalize(c: any): Character | undefined {
  const base = c.base ?? {}
  const id = resolveId(base)
  if (!id) return undefined

  const stats: Character['stats'] = {}
  for (const p of [...(c.base_properties ?? []), ...(c.selected_properties ?? []), ...(c.extra_properties ?? []), ...(c.element_properties ?? [])]) {
    const key = FINAL_PROPS[p.property_type]
    if (key && stats[key] === undefined) stats[key] = parseValue(p.final)
  }

  const artifacts: Artifact[] = (c.relics ?? []).map((r: any): Artifact => ({
    setId: (setInfo.has(String(r.set?.id)) ? String(r.set.id) : undefined) ?? relicSetId(r.id) ?? setByPt(r.set?.name ?? '')?.id ?? '',
    slot: HOYOLAB_SLOTS[r.pos],
    rarity: r.rarity,
    level: r.level,
    mainStat: NUMERIC_PROPS[r.main_property?.property_type],
    mainValue: parseValue(r.main_property?.value ?? 0),
    substats: (r.sub_property_list ?? [])
      .map((s: any) => ({ key: NUMERIC_PROPS[s.property_type], value: parseValue(s.value) }))
      .filter((s: any) => s.key),
    icon: r.icon,
  }))

  const order = skillOrder(id)
  const lv = (i: number) => (c.skills ?? []).find((s: any) => s.skill_id === order[i])?.level ?? 1

  return {
    id,
    level: base.level ?? 1,
    constellation: base.actived_constellation_num ?? 0,
    talents: order.length >= 3 ? { auto: lv(0), skill: lv(1), burst: lv(2) } : undefined,
    weapon: c.weapon && {
      id: String(c.weapon.id),
      level: c.weapon.level,
      ascension: c.weapon.promote_level,
      refinement: c.weapon.affix_level,
      rarity: c.weapon.rarity,
      icon: c.weapon.icon,
    },
    artifacts: artifacts.filter((a) => a.slot && a.mainStat),
    stats,
  }
}

/** Notas em Tempo Real: resina, comissões, expedições, moeda do reino, chefes semanais. */
export async function fetchDailyNote(uid: string, cookies: HoyolabCookies): Promise<DailyNote> {
  const d = await request('GET', 'dailyNote', { role_id: uid, server: serverOf(uid) }, cookies).catch((e) => {
    // nas notas, "dados privados" significa que as Notas em Tempo Real estão desligadas
    if (e instanceof HoyolabError && (e.retcode === 10102 || e.retcode === 10103)) throw new HoyolabError(RETCODES[10103], e.retcode)
    throw e
  })
  const secs = (v: unknown) => Number(v) || 0
  return {
    fetchedAt: new Date().toISOString(),
    resin: d.current_resin,
    maxResin: d.max_resin,
    resinFullIn: secs(d.resin_recovery_time),
    commissionsDone: d.finished_task_num,
    commissionsTotal: d.total_task_num,
    commissionRewardClaimed: !!d.is_extra_task_reward_received,
    weeklyBossDiscounts: d.remain_resin_discount_num,
    weeklyBossDiscountsMax: d.resin_discount_num_limit,
    realmCurrency: d.current_home_coin,
    realmCurrencyMax: d.max_home_coin,
    realmCurrencyFullIn: secs(d.home_coin_recovery_time),
    expeditions: (d.expeditions ?? []).map((e: any) => ({
      icon: e.avatar_side_icon,
      done: e.status === 'Finished',
      remaining: secs(e.remained_time),
    })),
    expeditionsMax: d.max_expedition_num,
    transformerReady: d.transformer?.obtained ? !!d.transformer?.recovery_time?.reached : undefined,
  }
}

/** Abismo do ciclo atual: estrelas por sala e os times usados em cada metade. */
export async function fetchSpiralAbyss(uid: string, cookies: HoyolabCookies): Promise<AbyssView> {
  const d = await request('GET', 'spiralAbyss', { role_id: uid, server: serverOf(uid), schedule_type: 1 }, cookies)
  const chambers = (d.floors ?? []).flatMap((f: any) => (f.levels ?? []).map((l: any) => ({
    floor: f.index,
    chamber: l.index,
    stars: l.star,
    halves: (l.battles ?? [])
      .sort((a: any, b: any) => a.index - b.index)
      .map((b: any) => (b.avatars ?? []).map((a: any) => resolveId({ id: a.id, element: a.element }) ?? String(a.id))),
  })))
  return {
    start: new Date(Number(d.start_time) * 1000).toISOString(),
    end: new Date(Number(d.end_time) * 1000).toISOString(),
    maxFloor: d.max_floor,
    stars: d.total_star,
    battles: d.total_battle_times,
    chambers,
  }
}
