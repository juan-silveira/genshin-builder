// Gera data/gamedb/farm.json a partir do genshin-db: custos de ascensão/talentos e onde achar cada material.
// Rodado por `npm run update-data`. Tudo em português.
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import type { Cost, FarmData } from '../shared/farm-types'

const require = createRequire(import.meta.url)
const g = require('genshin-db')

const PT = { queryLanguages: ['English'], resultLanguage: 'Portuguese' }
const EN = { queryLanguages: ['English'], resultLanguage: 'English' }
const names = (folder: string): string[] => g[folder]('names', { matchCategories: true, ...EN })

const costList = (list: any[] | undefined): Cost[] =>
  (list ?? []).filter((c) => c.id !== 202).map((c) => ({ id: c.id, count: c.count })) // 202 = Mora
const moraOf = (list: any[] | undefined) => (list ?? []).find((c) => c.id === 202)?.count ?? 0

const data: FarmData = { characters: {}, weapons: {}, sets: {}, materials: {} }
const usedMaterials = new Set<number>()
const track = (costs: Cost[]) => costs.forEach((c) => usedMaterials.add(c.id))

for (const name of names('characters')) {
  const c = g.characters(name, PT)
  if (!c?.id || c.id === 10000005 || c.id === 10000007) continue // Viajante tem materiais por elemento
  const t = g.talents(name, PT)
  const ascend = [1, 2, 3, 4, 5, 6].map((i) => costList(c.costs?.[`ascend${i}`]))
  const talent = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => costList(t?.costs?.[`lvl${l}`]))
  ascend.forEach(track)
  talent.forEach(track)
  data.characters[String(c.id)] = {
    ascend,
    ascendMora: [1, 2, 3, 4, 5, 6].map((i) => moraOf(c.costs?.[`ascend${i}`])),
    talent,
    talentMora: [2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => moraOf(t?.costs?.[`lvl${l}`])),
  }
}

for (const name of names('weapons')) {
  const w = g.weapons(name, PT)
  if (!w?.id || w.rarity < 3) continue
  const ascend = [1, 2, 3, 4, 5, 6].map((i) => costList(w.costs?.[`ascend${i}`]))
  ascend.forEach(track)
  data.weapons[String(w.id)] = { ascend }
}

// domínios: entrada/região e, para os de artefato, quais sets dão
const domainInfo = new Map<string, { entrance: string; region: string }>()
const setDomain = new Map<string, { domain: string; entrance: string; region: string }>()
for (const name of g.domains('names', { matchCategories: true, ...PT })) {
  const d = g.domains(name, { queryLanguages: ['Portuguese'], resultLanguage: 'Portuguese' })
  if (!d) continue
  const base = d.name.replace(/\s+[IVX]+$/, '')
  domainInfo.set(base, { entrance: d.entranceName, region: d.regionName })
  if (d.domainType === 'UI_ABYSSUS_RELIC') {
    for (const r of d.rewardPreview ?? []) {
      if (r.rarity && !setDomain.has(r.name)) setDomain.set(r.name, { domain: base, entrance: d.entranceName, region: d.regionName })
    }
  }
}

for (const name of names('artifacts')) {
  const a = g.artifacts(name, PT)
  if (!a?.id) continue
  const dom = setDomain.get(a.name)
  data.sets[String(a.id)] = dom ?? { domain: undefined, entrance: undefined, region: undefined }
}

const materialsById = new Map<number, any>()
for (const name of names('materials')) {
  const m = g.materials(name, PT)
  if (m?.id && usedMaterials.has(m.id)) materialsById.set(m.id, m)
}

for (const id of usedMaterials) {
  const m = materialsById.get(id)
  if (!m) continue
  const domain = m.dropDomainName?.replace(/\s+[IVX]+$/, '')
  const dom = domain ? domainInfo.get(domain) : undefined
  data.materials[String(id)] = {
    name: m.name,
    rarity: m.rarity,
    type: m.typeText,
    domain,
    entrance: dom?.entrance,
    region: dom?.region,
    days: m.daysOfWeek,
    sources: (m.sources ?? []).filter((s: string) => !/^Ir para/i.test(s) && !s.includes('{0}')),
    icon: m.images?.filename_icon,
  }
}

// --- marcadores do mapa interativo oficial (HoYoLAB), em português
const MAP_API = 'https://sg-public-api-static.hoyoverse.com/common/map_user/ys_obc/v1/map'
const MAP_Q = 'map_id=2&app_sn=ys_obc&lang=pt-pt'
const MAP_TREE = `${MAP_API}/label/tree?${MAP_Q}`
// o marcador "Domínio" mostra todos os domínios e a API não diz qual é qual: não serve para apontar um
const DOMAIN_LABEL = 154
try {
  const tree: any[] = (await (await fetch(MAP_TREE)).json()).data?.tree ?? []
  const labels: { id: number; name: string; top: string }[] = []
  const walk = (n: any, top: string) => {
    labels.push({ id: n.id, name: n.name, top })
    for (const c of n.children ?? []) walk(c, top)
  }
  for (const t of tree) walk(t, t.name)
  const exact = new Map(labels.map((l) => [l.name.toLowerCase(), l.id]))
  // inimigos/chefes: o nome do marcador aparece no texto da fonte ("Dropado por Manifestação Trovejante…")
  const enemies = labels.filter((l) => l.top === 'Inimigos' && l.name !== l.top && l.name.length >= 4).sort((a, b) => b.name.length - a.name.length)
  let matched = 0
  for (const [id, m] of Object.entries(data.materials)) {
    if (m.domain) continue
    let label = exact.get(m.name.toLowerCase())
    if (!label) {
      const text = m.sources.join(' ').toLowerCase()
      label = enemies.find((e) => text.includes(e.name.toLowerCase()))?.id
    }
    if (label) { data.materials[id].mapLabel = label; matched++ }
  }
  console.log(`mapa: ${matched} de ${Object.keys(data.materials).length} materiais com marcador`)

  // pontos de cada marcador usado, já em pixels da imagem do mapa (origem somada)
  const info = JSON.parse((await (await fetch(`${MAP_API}/info?${MAP_Q}`)).json()).data.info.detail)
  const [ox, oy] = info.origin
  const used = new Set(Object.values(data.materials).map((m) => m.mapLabel).filter(Boolean))
  // [x, y, id do ponto no mapa oficial] — o id permite salvar o que a pessoa já coletou
  const points: Record<string, [number, number, number][]> = {}
  const list = (await (await fetch(`${MAP_API}/point/list?${MAP_Q}`)).json()).data.point_list as any[]
  for (const p of list) {
    if (!used.has(p.label_id) || p.label_id === DOMAIN_LABEL) continue
    ;(points[p.label_id] ??= []).push([Math.round(p.x_pos + ox), Math.round(p.y_pos + oy), p.id])
  }
  const mapData = {
    size: info.total_size as [number, number],
    slice: 2048,
    slices: (info.slices as { url: string }[][]).map((row) => row.map((s) => s.url)),
    points,
  }
  await mkdir('data/gamedb', { recursive: true })
  await writeFile('data/gamedb/map.json', JSON.stringify(mapData))
  console.log(`mapa: ${Object.values(points).reduce((n, p) => n + p.length, 0)} pontos de ${Object.keys(points).length} marcadores`)
} catch (e) {
  console.warn('mapa: não consegui baixar os marcadores (seguindo sem eles)', e)
}

// --- nomes EN → PT de materiais e comidas (recompensas dos códigos vêm em inglês)
const itemNames: Record<string, string> = {}
for (const folder of ['materials', 'foods']) {
  for (const en of names(folder)) {
    const pt = g[folder](en, PT)?.name
    if (pt && pt !== en) itemNames[en.toLowerCase()] = pt
  }
}

await mkdir('data/gamedb', { recursive: true })
await writeFile('data/gamedb/item-names.json', JSON.stringify(itemNames))
await writeFile('data/gamedb/farm.json', JSON.stringify(data))
console.log(
  `ok farm.json — ${Object.keys(data.characters).length} personagens, ${Object.keys(data.weapons).length} armas, ` +
    `${Object.keys(data.sets).length} sets, ${Object.keys(data.materials).length} materiais`,
)
