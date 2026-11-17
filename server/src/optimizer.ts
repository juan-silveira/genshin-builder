// Otimizador de time: redistribui os artefatos e armas JÁ EQUIPADOS na conta entre os membros de uma ou
// mais equipes. No jogo, equipar algo que está em outro personagem troca as peças entre os dois.
// Heurística gulosa: o carry escolhe primeiro, depois os demais pela força. Não é ótimo global, mas é
// previsível e explica cada troca.
import type { Guide, GuideRole } from '../../shared/guide-types'
import { SLOT_LABEL, STAT_SHORT } from '../../shared/labels'
import type { Account, Artifact, Character, SlotKey, StatKey } from '../../shared/types'
import { SLOTS } from '../../shared/types'
import type { OptimizeResult, RoleView } from '../../shared/view-types'
import { analyzeCharacter, buildPct, gradeOf, scoreArtifact } from './analysis'
import { characters, setByEn, setInfo, weaponByEn, weaponInfo } from './gamedata'

const GENERIC: GuideRole = {
  name: 'Genérico',
  weapons: [],
  artifactSets: [],
  mainStats: { sands: [], goblet: [], circlet: [] },
  substats: { critRate_: 1, critDMG_: 1, atk_: 0.5, hp_: 0.4, def_: 0.3, eleMas: 0.5, enerRech_: 0.5 },
  talentPriority: [],
}

interface Piece { key: string; owner: string; a: Artifact }

/**
 * Bônus de set em "rolagens úteis". Um 4 peças bom vale ~15–25% de dano, o que equivale a
 * umas 12–14 rolagens boas; opções piores do guia valem menos.
 */
const setBonus = (optionIdx: number) => Math.max(6, 14 - optionIdx * 2.5)

/** valor de uma peça para um papel, em "rolagens úteis"; principal errado custa caro, mas pode valer para fechar um set */
function pieceValue(a: Artifact, role: GuideRole): number {
  const subs = scoreArtifact(a, role.substats).score
  if (a.slot === 'flower' || a.slot === 'plume') return subs
  const allowed = role.mainStats[a.slot]
  if (!allowed.length) return subs + 3 // sem guia: qualquer principal serve
  const idx = allowed.indexOf(a.mainStat)
  if (idx === -1) return subs - 6
  return subs + (5 - idx * 0.7) * Math.min(1, (a.level + 4) / 24)
}

const mainOk = (a: Artifact, role: GuideRole) =>
  a.slot === 'flower' || a.slot === 'plume' || !role.mainStats[a.slot].length || role.mainStats[a.slot].includes(a.mainStat)

/** todas as formas de distribuir os grupos de set pelos 5 slots (≤ 30 combinações) */
function labelings(groups: { setId: string; pieces: number }[]): (string | null)[][] {
  const out: (string | null)[][] = []
  const counts = groups.map((g) => g.pieces)
  const rec = (i: number, acc: (string | null)[]) => {
    if (i === SLOTS.length) {
      if (counts.every((c) => c === 0)) out.push([...acc])
      return
    }
    for (let g = 0; g < groups.length; g++) {
      if (counts[g] === 0) continue
      counts[g]--
      acc.push(groups[g].setId)
      rec(i + 1, acc)
      acc.pop()
      counts[g]++
    }
    acc.push(null)
    rec(i + 1, acc)
    acc.pop()
  }
  rec(0, [])
  return out
}

function bestLoadout(pool: Map<string, Piece>, role: GuideRole) {
  const options: { groups: { setId: string; pieces: number }[]; bonus: number }[] = role.artifactSets.map((o, i) => ({
    groups: o.sets.map((s) => ({ setId: setByEn(s.name)?.id ?? '', pieces: s.pieces })),
    bonus: setBonus(i),
  }))
  options.push({ groups: [], bonus: 0 })

  const bySlot = new Map<SlotKey, Piece[]>()
  for (const p of pool.values()) {
    const v = pieceValue(p.a, role)
    if (v === -Infinity) continue
    const list = bySlot.get(p.a.slot) ?? []
    list.push(p)
    bySlot.set(p.a.slot, list)
  }
  for (const list of bySlot.values()) list.sort((x, y) => pieceValue(y.a, role) - pieceValue(x.a, role))

  let best: { value: number; pieces: Piece[] } = { value: -Infinity, pieces: [] }
  for (const opt of options) {
    for (const labels of labelings(opt.groups)) {
      const chosen: Piece[] = []
      let value = opt.bonus
      let ok = true
      for (let i = 0; i < SLOTS.length; i++) {
        const want = labels[i]
        // principal errado só entra se for para fechar o set; em slot livre, exige principal certo
        const cand = (bySlot.get(SLOTS[i]) ?? []).find((p) => (want ? p.a.setId === want : mainOk(p.a, role)))
        if (!cand) {
          if (want) { ok = false; break }
          continue // slot vazio
        }
        chosen.push(cand)
        value += pieceValue(cand.a, role)
      }
      if (ok && value > best.value) best = { value, pieces: chosen }
    }
  }
  return best
}

export function weaponValue(id: string, level: number, refinement: number, role: GuideRole): number {
  const info = weaponInfo.get(id)
  const idx = role.weapons.findIndex((w) => weaponByEn(w.name)?.id === id)
  const fit = idx >= 0 ? 10 - idx * 1.2 : (info?.rarity ?? 3) * 1.2
  return fit + refinement * 0.3 + (level / 90) * 3
}

export function optimizeTeams(
  acc: Account,
  guides: Map<string, Guide>,
  memberIds: string[],
  /** ganho mínimo (em rolagens úteis) para trocar o conjunto de um personagem */
  minGain = 3,
): OptimizeResult {
  const byId = new Map(acc.characters.map((c) => [c.id, c]))
  const roleOf = (c: Character) => {
    const g = guides.get(c.id)
    if (!g) return GENERIC
    return g.roles[analyzeCharacter(c, g, new Set()).bestRole]
  }

  // prioridade: ordem recebida (carry de cada time primeiro) desempata pela força
  const members = memberIds.map((id) => byId.get(id)).filter((c): c is Character => !!c)

  // --- artefatos
  const pool = new Map<string, Piece>()
  for (const c of acc.characters) for (const a of c.artifacts) pool.set(`${c.id}:${a.slot}`, { key: `${c.id}:${a.slot}`, owner: c.id, a })

  const result: OptimizeResult = { members: [], artifactMoves: [], weaponMoves: [] }
  const assigned = new Map<string, Artifact[]>()

  for (const c of members) {
    const role = roleOf(c)
    const current = c.artifacts.map((a) => pool.get(`${c.id}:${a.slot}`)).filter((p): p is Piece => !!p)
    const currentValue = loadoutValue(current, role)
    const best = bestLoadout(pool, role)
    // só troca se ganhar de verdade (evita mexer por 1%)
    const pick = best.value > currentValue + minGain ? best.pieces : current
    for (const p of pick) pool.delete(p.key)
    assigned.set(c.id, pick.map((p) => p.a))
    for (const p of pick) {
      if (p.owner === c.id) continue
      result.artifactMoves.push({
        to: c.id,
        toName: characters.get(c.id)?.name ?? c.id,
        from: p.owner,
        fromName: characters.get(p.owner)?.name ?? p.owner,
        fromInTeam: memberIds.includes(p.owner),
        slot: p.a.slot,
        slotName: SLOT_LABEL[p.a.slot],
        setName: setInfo.get(p.a.setId)?.name ?? '',
        mainStat: STAT_SHORT[p.a.mainStat as StatKey],
        level: p.a.level,
      })
    }
  }

  // --- armas
  const weaponPool = new Map<string, { owner: string; w: NonNullable<Character['weapon']> }>()
  for (const c of acc.characters) if (c.weapon) weaponPool.set(c.id, { owner: c.id, w: c.weapon })
  const newWeapon = new Map<string, NonNullable<Character['weapon']>>()
  for (const c of members) {
    const role = roleOf(c)
    const type = characters.get(c.id)?.weaponType
    let best = c.weapon && weaponPool.has(c.id) ? weaponPool.get(c.id)! : undefined
    let bestV = best ? weaponValue(best.w.id, best.w.level, best.w.refinement, role) + 0.5 : -Infinity
    for (const cand of weaponPool.values()) {
      if (weaponInfo.get(cand.w.id)?.type !== type) continue
      const v = weaponValue(cand.w.id, cand.w.level, cand.w.refinement, role)
      if (v > bestV) { best = cand; bestV = v }
    }
    if (!best) continue
    weaponPool.delete(best.owner)
    newWeapon.set(c.id, best.w)
    if (best.owner !== c.id) {
      result.weaponMoves.push({
        to: c.id,
        toName: characters.get(c.id)?.name ?? c.id,
        from: best.owner,
        fromName: characters.get(best.owner)?.name ?? best.owner,
        fromInTeam: memberIds.includes(best.owner),
        weapon: weaponInfo.get(best.w.id)?.name ?? best.w.id,
        level: best.w.level,
        refinement: best.w.refinement,
      })
    }
  }

  // --- antes/depois
  for (const c of members) {
    const role = roleOf(c)
    const guide = guides.get(c.id)
    const before = analyzeCharacter(c, guide, new Set())
    const after = analyzeCharacter({ ...c, artifacts: assigned.get(c.id) ?? c.artifacts, weapon: newWeapon.get(c.id) ?? c.weapon }, guide, new Set())
    const beforePct = guide ? before.roles[before.bestRole].buildPct : buildPct(before.artifacts)
    const afterPct = guide ? after.roles[after.bestRole].buildPct : buildPct(after.artifacts)
    result.members.push({
      id: c.id,
      name: characters.get(c.id)?.name ?? c.id,
      role: role.name,
      before: { pct: beforePct, grade: gradeOf(beforePct), power: before.power, set: activeSet(before.roles[before.bestRole]) },
      after: { pct: afterPct, grade: gradeOf(afterPct), power: after.power, set: activeSet(after.roles[after.bestRole]) },
    })
  }
  return result
}

function loadoutValue(pieces: Piece[], role: GuideRole): number {
  let value = pieces.reduce((s, p) => s + Math.max(-20, pieceValue(p.a, role)), 0)
  const counts = new Map<string, number>()
  for (const p of pieces) counts.set(p.a.setId, (counts.get(p.a.setId) ?? 0) + 1)
  const idx = role.artifactSets.findIndex((o) => o.sets.every((s) => (counts.get(setByEn(s.name)?.id ?? '') ?? 0) >= s.pieces))
  if (idx >= 0) value += setBonus(idx)
  return value
}

function activeSet(role: RoleView | undefined): string | undefined {
  const opt = role?.artifactSets.find((o) => o.matched)
  return opt?.sets.map((s) => `${s.pieces}× ${s.name}`).join(' + ')
}
