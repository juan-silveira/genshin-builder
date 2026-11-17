// Plano de farm: o que falta para ascender personagem/arma e subir talentos, e onde achar cada material.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Cost, FarmData, MaterialInfo } from '../../shared/farm-types'
import type { TalentKey } from '../../shared/guide-types'
import { TALENT_LABEL } from '../../shared/labels'
import type { Character } from '../../shared/types'
import type { FarmMaterial, FarmPlan, MaterialCategory, MaterialMap } from '../../shared/view-types'
import { DATA } from './paths'

const FILE = join(DATA, 'gamedb/farm.json')
const farm: FarmData | undefined = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : undefined

export const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

/** dia da semana do servidor do jogo (o dia vira às 04:00 do horário do servidor) */
export function gameWeekday(uid: string | undefined, now = Date.now()): number {
  const prefix = uid?.slice(0, -8)
  const offset = prefix === '7' ? 1 : prefix === '8' || prefix === '18' || prefix === '9' ? 8 : -5
  return new Date(now + (offset - 4) * 3_600_000).getUTCDay()
}

const LEVEL_CAPS = [20, 40, 50, 60, 70, 80, 90]
/** fase de ascensão estimada pelo nível quando a fonte não informa (no limite, assume não ascendido) */
const phaseFromLevel = (level: number) => {
  const i = LEVEL_CAPS.findIndex((cap) => level <= cap)
  return i === -1 ? 6 : i
}

export function categoryOf(id: number, m: MaterialInfo): MaterialCategory {
  if (m.domain && m.days?.length) return 'dominio'
  const prefix = Math.floor(id / 1000)
  if (prefix === 104) return 'gema'
  if (prefix === 113) return m.rarity === 5 || m.sources.some((s) => /Desafio/i.test(s)) ? 'semanal' : 'chefe'
  if (prefix === 101) return 'especialidade'
  if (prefix === 112) return 'comum'
  return 'outro'
}

const add = (into: Map<number, number>, costs: Cost[]) => {
  for (const c of costs) into.set(c.id, (into.get(c.id) ?? 0) + c.count)
}

export function materialView(id: number, count: number, weekday: number): FarmMaterial | undefined {
  const m = farm?.materials[String(id)]
  if (!m) return undefined
  const category = categoryOf(id, m)
  const where =
    category === 'dominio'
      ? `${m.domain}${m.entrance ? ` — ${m.entrance}` : ''}${m.region ? ` (${m.region})` : ''}`
      : m.sources[0] ?? ''
  return {
    id,
    name: m.name,
    rarity: m.rarity,
    count,
    category,
    where,
    extra: category === 'dominio' ? undefined : m.sources.slice(1, 2)[0],
    days: m.days,
    availableToday: !m.days?.length || m.days.includes(WEEKDAYS[weekday]),
    icon: m.icon ? `https://gi.yatta.moe/assets/UI/${m.icon}.png` : undefined,
    mapUrl: m.mapLabel && mapPoints(m.mapLabel).length ? `/mapa/${id}` : undefined,
  }
}

/**
 * Metas: personagem e arma no 90; talentos pela prioridade do guia (1º → 9, 2º → 8).
 * Sem guia, só ascensão.
 */
export function farmPlan(c: Character, talentPriority: TalentKey[] | undefined, weekday: number): FarmPlan | undefined {
  const data = farm?.characters[c.id.split('-')[0]]
  if (!data) return undefined
  const need = new Map<number, number>()
  const goals: string[] = []
  let mora = 0

  const phase = c.ascension ?? phaseFromLevel(c.level)
  if (phase < 6) {
    for (let p = phase; p < 6; p++) { add(need, data.ascend[p]); mora += data.ascendMora[p] }
    goals.push(`Ascender até o nível 90 (falta${6 - phase > 1 ? 'm' : ''} ${6 - phase} ascens${6 - phase > 1 ? 'ões' : 'ão'})`)
  }

  if (c.talents && talentPriority?.length) {
    const targets: [TalentKey, number][] = talentPriority.slice(0, 2).map((t, i) => [t, i === 0 ? 9 : 8])
    for (const [t, target] of targets) {
      const cur = c.talents[t]
      if (cur >= target) continue
      for (let lvl = cur + 1; lvl <= target; lvl++) { add(need, data.talent[lvl - 2]); mora += data.talentMora[lvl - 2] }
      goals.push(`${TALENT_LABEL[t]}: ${cur} → ${target}`)
    }
  }

  if (c.weapon) {
    const w = farm?.weapons[c.weapon.id]
    const wPhase = c.weapon.ascension ?? phaseFromLevel(c.weapon.level)
    if (w && wPhase < 6) {
      for (let p = wPhase; p < 6; p++) add(need, w.ascend[p])
      goals.push(`Arma até o nível 90 (fase ${wPhase}/6)`)
    }
  }

  const order: MaterialCategory[] = ['dominio', 'semanal', 'chefe', 'gema', 'especialidade', 'comum', 'outro']
  const materials = [...need.entries()]
    .map(([id, count]) => materialView(id, count, weekday))
    .filter((m): m is FarmMaterial => !!m)
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || (b.rarity ?? 0) - (a.rarity ?? 0))

  return { goals, materials, mora }
}

export function setDomain(setId: string) {
  return farm?.sets[setId]
}

export const hasFarmData = () => !!farm

// --- mapa próprio (imagens oficiais de Teyvat + pontos do mapa interativo da HoYoLAB)
const MAP_FILE = join(DATA, 'gamedb/map.json')
const mapData: { size: [number, number]; slice: number; slices: string[][]; points: Record<string, [number, number, number][]> } | undefined =
  existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, 'utf8')) : undefined

const mapPoints = (label: number) => mapData?.points[String(label)] ?? []

export function materialMap(id: string, collected: Record<string, number> = {}): MaterialMap | undefined {
  const m = farm?.materials[id]
  if (!m?.mapLabel || !mapData) return undefined
  const points = mapPoints(m.mapLabel)
  if (!points.length) return undefined
  const respawnHours = categoryOf(Number(id), m) === 'especialidade' ? 48 : 24
  const fresh = Date.now() - respawnHours * 3_600_000
  return {
    name: m.name,
    icon: m.icon ? `https://gi.yatta.moe/assets/UI/${m.icon}.png` : undefined,
    where: m.sources[0],
    collected: points.filter((p) => (collected[p[2]] ?? 0) > fresh).map((p) => p[2]),
    respawnHours,
    officialUrl: mapUrl(m.mapLabel),
    size: mapData.size,
    slice: mapData.slice,
    slices: mapData.slices,
    points,
  }
}

/** mapa interativo oficial da HoYoLAB, em português, mostrando só um tipo de marcador */
export const mapUrl = (label: number) =>
  `https://act.hoyolab.com/ys/app/interactive-map/index.html?lang=pt-pt#/map/2?shown_types=${label}`
