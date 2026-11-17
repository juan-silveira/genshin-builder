// Confere os guias curados contra os dados do jogo: nomes, tipo de arma, peças de set e chaves de atributo.
import { readdirSync, readFileSync } from 'node:fs'
import { characterByEn, setByEn, weaponByEn } from '../server/src/gamedata'
import type { Guide, TeamGuide } from '../shared/guide-types'

const STAT_KEYS = new Set([
  'hp', 'hp_', 'atk', 'atk_', 'def', 'def_', 'eleMas', 'enerRech_', 'critRate_', 'critDMG_', 'heal_',
  'physical_dmg_', 'pyro_dmg_', 'electro_dmg_', 'hydro_dmg_', 'dendro_dmg_', 'anemo_dmg_', 'geo_dmg_', 'cryo_dmg_',
])
const TALENTS = new Set(['auto', 'skill', 'burst'])

const errors: string[] = []
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`)
const seen = new Set<string>()
let guideCount = 0

const dir = 'data/guides'
for (const file of readdirSync(dir).filter((f) => f.startsWith('characters') && f.endsWith('.json'))) {
  const guides: Guide[] = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'))
  for (const g of guides) {
    const where = `${file} › ${g.character}`
    const ch = characterByEn(g.character)
    if (!ch) { err(where, 'personagem não encontrado'); continue }
    if (seen.has(ch.id)) err(where, 'personagem duplicado')
    seen.add(ch.id)
    guideCount++
    if (!g.roles?.length) err(where, 'sem papéis')
    for (const r of g.roles ?? []) {
      const w = `${where} › ${r.name}`
      if (!r.weapons?.length) err(w, 'sem armas')
      for (const wp of r.weapons ?? []) {
        const info = weaponByEn(wp.name)
        if (!info) err(w, `arma não encontrada: "${wp.name}"`)
        else if (ch.weaponType && info.type !== ch.weaponType) err(w, `arma "${wp.name}" é ${info.type}, personagem usa ${ch.weaponType}`)
      }
      if (!r.artifactSets?.length) err(w, 'sem sets')
      for (const opt of r.artifactSets ?? []) {
        const pieces = opt.sets.reduce((n, s) => n + s.pieces, 0)
        if (pieces !== 4) err(w, `combinação de sets soma ${pieces} peças (esperado 4)`)
        for (const s of opt.sets) if (!setByEn(s.name)) err(w, `set não encontrado: "${s.name}"`)
      }
      for (const slot of ['sands', 'goblet', 'circlet'] as const) {
        const list = r.mainStats?.[slot]
        if (!list?.length) err(w, `sem atributo principal para ${slot}`)
        for (const k of list ?? []) if (!STAT_KEYS.has(k)) err(w, `stat inválido em ${slot}: ${k}`)
      }
      for (const [k, v] of Object.entries(r.substats ?? {})) {
        if (!STAT_KEYS.has(k)) err(w, `substat inválido: ${k}`)
        if (typeof v !== 'number' || v < 0 || v > 1) err(w, `peso fora de 0..1: ${k}=${v}`)
      }
      if (!Object.keys(r.substats ?? {}).length) err(w, 'sem pesos de substatus')
      for (const t of r.talentPriority ?? []) if (!TALENTS.has(t)) err(w, `talento inválido: ${t}`)
    }
  }
}

let teamCount = 0
try {
  const teams: TeamGuide[] = JSON.parse(readFileSync(`${dir}/teams.json`, 'utf8'))
  for (const t of teams) {
    teamCount++
    const where = `teams.json › ${t.name}`
    if (t.slots.length !== 4) err(where, `equipe com ${t.slots.length} slots`)
    if (!characterByEn(t.carry)) err(where, `carry não encontrado: "${t.carry}"`)
    if (!t.slots.flat().includes(t.carry)) err(where, 'carry não está em nenhum slot')
    for (const name of t.slots.flat()) if (!characterByEn(name)) err(where, `personagem não encontrado: "${name}"`)
    if (!t.rotation?.length) err(where, 'sem rotação')
  }
} catch (e: any) {
  if (e.code !== 'ENOENT') throw e
}

if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`\n${errors.length} erro(s).`)
  process.exit(1)
}
console.log(`OK — ${guideCount} guias de personagem, ${teamCount} equipes.`)
