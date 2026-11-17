// Motor de recomendações: compara a build atual com o guia curado e monta as equipes possíveis.
import type { Guide, GuideRole, TeamGuide } from '../../shared/guide-types'
import { SLOT_LABEL, STAT_LABEL, TALENT_LABEL } from '../../shared/labels'
import type { Account, Artifact, Character, SlotKey, StatKey } from '../../shared/types'
import { SLOTS } from '../../shared/types'
import type {
  AccountView, ArtifactView, CharacterView, Grade, NamedRef, Readiness, RoleView, TeamMemberView, TeamView, Tip, UpgradeStep,
} from '../../shared/view-types'
import { farmPlan, gameWeekday, setDomain } from './farm'
import { characterByEn, characters, localizeText, setByEn, setInfo, weaponByEn, weaponInfo } from './gamedata'

/** valor máximo de uma rolagem de substatus em artefato 5★ */
const MAX_ROLL: Partial<Record<StatKey, number>> = {
  hp: 298.75, hp_: 5.83, atk: 19.45, atk_: 5.83, def: 23.15, def_: 7.29,
  eleMas: 23.31, enerRech_: 6.48, critRate_: 3.89, critDMG_: 7.77,
}
/** "rolagens úteis" de um artefato 5★ +20 excelente (≈ 7 de ~8,5 possíveis) */
const IDEAL_SCORE = 7

/** pesos usados quando o personagem ainda não tem guia */
const GENERIC_WEIGHTS: Partial<Record<StatKey, number>> = {
  critRate_: 1, critDMG_: 1, atk_: 0.5, hp_: 0.4, def_: 0.3, eleMas: 0.5, enerRech_: 0.5,
}

export const gradeOf = (pct: number): Grade => (pct >= 80 ? 'S' : pct >= 60 ? 'A' : pct >= 40 ? 'B' : pct >= 25 ? 'C' : 'D')

const ref = (m: Map<string, { id: string; name: string; icon?: string; rarity?: number }>, id: string): NamedRef => {
  const v = m.get(id)
  return { id, name: v?.name ?? `#${id}`, icon: v?.icon, rarity: v?.rarity }
}

export function scoreArtifact(a: Artifact, weights: Partial<Record<StatKey, number>>, role?: GuideRole): ArtifactView {
  const substats = a.substats.map((s) => ({ ...s, weight: weights[s.key] ?? 0 }))
  const score = substats.reduce((sum, s) => sum + (s.weight * s.value) / (MAX_ROLL[s.key] ?? Infinity), 0)
  const critValue = a.substats.reduce(
    (cv, s) => cv + (s.key === 'critRate_' ? 2 * s.value : s.key === 'critDMG_' ? s.value : 0), 0,
  )
  let mainStatOk: boolean | null = null
  if (role && (a.slot === 'sands' || a.slot === 'goblet' || a.slot === 'circlet')) {
    mainStatOk = role.mainStats[a.slot].includes(a.mainStat)
  }
  const pct = Math.min(100, Math.round((score / IDEAL_SCORE) * 100))
  return {
    slot: a.slot,
    set: { ...ref(setInfo, a.setId) },
    rarity: a.rarity,
    level: a.level,
    mainStat: a.mainStat,
    mainValue: a.mainValue,
    mainStatOk,
    substats,
    score: Math.round(score * 10) / 10,
    pct,
    grade: mainStatOk === false ? (gradeOf(pct) === 'S' || gradeOf(pct) === 'A' ? 'C' : 'D') : gradeOf(pct),
    critValue: Math.round(critValue * 10) / 10,
    icon: a.icon,
  }
}

/** nota de referência de uma peça "boa" (≈ 4,5 rolagens úteis, CV ~30 para quem usa crítico) */
const GOOD_PIECE_PCT = 65

/**
 * Plano para subir a nota: para cada slot, a melhor ação (equipar, corrigir o principal, upar até +20 ou trocar
 * por uma peça boa), ordenadas pelo ganho. Ganhos são estimativas — upar depende da sorte das rolagens.
 */
export function upgradePlan(arts: ArtifactView[], role: GuideRole): UpgradeStep[] {
  const top = (Object.entries(role.substats) as [StatKey, number][])
    .filter(([k]) => !['hp', 'atk', 'def'].includes(k))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => STAT_LABEL[k])
  const lookFor = `substatus de ${list(top)}`
  const mains = (slot: SlotKey) =>
    slot === 'sands' || slot === 'goblet' || slot === 'circlet' ? ` com ${list(role.mainStats[slot].map((k) => STAT_LABEL[k]))}` : ''

  const candidates: Omit<UpgradeStep, 'resultPct' | 'resultGrade'>[] = []
  const missing = SLOTS.filter((slot) => !arts.some((x) => x.slot === slot))
  const article: Record<SlotKey, string> = { flower: 'uma', plume: 'uma', sands: 'um', goblet: 'um', circlet: 'uma' }
  if (missing.length >= 3) {
    // sem quase nada: um passo só, com os principais de cada slot
    const withMains = missing.map((slot) => `${SLOT_LABEL[slot]}${mains(slot)}`)
    candidates.push({ text: `Equipar artefatos: ${withMains.slice(0, -1).join('; ')} e ${withMains.at(-1)}`, lookFor, gain: (GOOD_PIECE_PCT * missing.length) / SLOTS.length })
  } else {
    for (const slot of missing) {
      candidates.push({ text: `Equipar ${article[slot]} ${SLOT_LABEL[slot]}${mains(slot)}`, lookFor, gain: GOOD_PIECE_PCT / SLOTS.length })
    }
  }
  for (const slot of SLOTS) {
    const a = arts.find((x) => x.slot === slot)
    if (!a) continue
    const current = a.mainStatOk === false ? a.pct * 0.4 : a.pct
    const options: Omit<UpgradeStep, 'resultPct' | 'resultGrade'>[] = []
    if (a.mainStatOk === false) {
      options.push({
        text: `Trocar ${SLOT_LABEL[slot]}: principal ${STAT_LABEL[a.mainStat]} → ${list(role.mainStats[slot as 'sands'].map((k) => STAT_LABEL[k]))}`,
        lookFor, gain: (Math.max(GOOD_PIECE_PCT, a.pct) - current) / SLOTS.length,
      })
    }
    if (a.rarity === 5 && a.level < 20 && a.mainStatOk !== false) {
      // rolagens que faltam (+4, +8, +12, +16, +20) × chance média de cair num substatus útil × valor médio da rolagem
      const left = 5 - Math.floor(a.level / 4)
      const usefulShare = a.substats.length ? a.substats.reduce((s, x) => s + x.weight, 0) / 4 : 0.4
      const expected = Math.min(100, ((a.score + left * usefulShare * 0.85) / IDEAL_SCORE) * 100)
      options.push({ text: `Subir ${SLOT_LABEL[slot]} de +${a.level} para +20`, gain: (expected - current) / SLOTS.length })
    }
    if (a.mainStatOk !== false && a.pct < GOOD_PIECE_PCT && (a.level >= 16 || a.rarity < 5)) {
      options.push({
        text: `Trocar ${SLOT_LABEL[slot]} (nota ${a.grade}) por uma peça melhor${mains(slot)}`,
        lookFor, gain: (GOOD_PIECE_PCT - current) / SLOTS.length,
      })
    }
    const best = options.sort((x, y) => y.gain - x.gain)[0]
    if (best && best.gain >= 1) candidates.push(best)
  }

  let pct = buildPct(arts)
  return candidates
    .sort((x, y) => y.gain - x.gain)
    .slice(0, 5)
    .map((c) => {
      pct = Math.min(100, pct + c.gain)
      return { ...c, gain: Math.round(c.gain), resultPct: Math.round(pct), resultGrade: gradeOf(pct) }
    })
}

/** qualidade média dos 5 slots; slot vazio vale 0 e atributo principal errado vale 40% */
export function buildPct(arts: ArtifactView[]): number {
  const total = SLOTS.reduce((sum, slot) => {
    const a = arts.find((x) => x.slot === slot)
    if (!a) return sum
    return sum + (a.mainStatOk === false ? a.pct * 0.4 : a.pct)
  }, 0)
  return Math.round(total / SLOTS.length)
}

function setCounts(c: Character) {
  const counts = new Map<string, number>()
  for (const a of c.artifacts) if (a.setId) counts.set(a.setId, (counts.get(a.setId) ?? 0) + 1)
  return counts
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ou ${xs.at(-1)}`)

function analyzeRole(c: Character, role: GuideRole, ownedWeapons: Set<string>): RoleView {
  const arts = c.artifacts.map((a) => scoreArtifact(a, role.substats, role))
  const counts = setCounts(c)
  const advice: Tip[] = []

  // artefatos faltando / sem upar
  const missing = SLOTS.filter((s) => !c.artifacts.some((a) => a.slot === s))
  if (missing.length) {
    advice.push({ level: 'alta', text: `Equipe artefatos em: ${list(missing.map((s) => SLOT_LABEL[s]))}.` })
  }
  const lowLevel = arts.filter((a) => a.rarity === 5 && a.level < 16)
  if (lowLevel.length) {
    advice.push({
      level: 'media',
      text: `Suba para +20: ${list(lowLevel.map((a) => `${SLOT_LABEL[a.slot]} (+${a.level})`))}. Artefatos baixos perdem muito atributo principal.`,
    })
  }

  // atributo principal errado
  for (const a of arts) {
    if (a.mainStatOk === false) {
      const slot = a.slot as 'sands' | 'goblet' | 'circlet'
      advice.push({
        level: 'alta',
        text: `${SLOT_LABEL[slot]} está com ${STAT_LABEL[a.mainStat]}; o ideal é ${list(role.mainStats[slot].map((k) => STAT_LABEL[k]))}.`,
      })
    }
  }

  // sets
  const artifactSets = role.artifactSets.map((opt) => {
    const sets = opt.sets.map((s) => {
      const id = setByEn(s.name)?.id ?? ''
      const d = setDomain(id)
      return { ...ref(setInfo, id), pieces: s.pieces, where: d?.domain && `${d.domain} — ${d.entrance} (${d.region})` }
    })
    return { sets, note: opt.note && localizeText(opt.note), matched: sets.every((s) => (counts.get(s.id) ?? 0) >= s.pieces) }
  })
  const matchedIdx = artifactSets.findIndex((o) => o.matched)
  const describe = (o: (typeof artifactSets)[number]) => o.sets.map((s) => `${s.pieces}× ${s.name}`).join(' + ')
  if (matchedIdx === -1 && c.artifacts.length) {
    advice.push({ level: 'alta', text: `Nenhum bônus de set recomendado ativo. Melhor opção: ${describe(artifactSets[0])}.` })
  } else if (matchedIdx > 0) {
    advice.push({ level: 'baixa', text: `Set ok. Upgrade futuro: ${describe(artifactSets[0])}.` })
  }

  // arma
  const weapons = role.weapons.map((w) => {
    const info = weaponByEn(w.name)
    const id = info?.id ?? ''
    return { ...ref(weaponInfo, id), note: w.note && localizeText(w.note), owned: ownedWeapons.has(id) }
  })
  const weaponIdx = c.weapon ? weapons.findIndex((w) => w.id === c.weapon!.id) : -1
  if (weaponIdx === -1) {
    const f2p = weapons.find((w) => w.rarity === 4)
    const best = weapons[0]
    advice.push({
      level: 'media',
      text: `Arma atual não está entre as recomendadas. Melhor: ${best.name}${f2p && f2p !== best ? `; opção acessível: ${f2p.name}` : ''}.`,
    })
  } else if (weaponIdx >= 2 && weapons[0]) {
    advice.push({ level: 'baixa', text: `Arma ok. Se conseguir, ${weapons[0].name} é a melhor opção.` })
  }

  // Recarga de Energia
  const er = c.stats.enerRech_
  if (role.erMin && er !== undefined && er < role.erMin - 0.5) {
    advice.push({
      level: 'alta',
      text: `Recarga de Energia em ${er.toFixed(0)}%, abaixo da meta (${role.erTarget ?? `${role.erMin}%`}). Use mais Recarga nos substatus ou no Relógio.`,
    })
  }

  // proporção crítica (só para quem escala com crítico)
  if ((role.substats.critRate_ ?? 0) >= 0.8) {
    const cr = c.stats.critRate_ ?? 0
    const cd = c.stats.critDMG_ ?? 0
    if (cr < 50 && cd > 2 * cr + 40) {
      advice.push({ level: 'media', text: `Taxa Crítica baixa (${cr.toFixed(0)}%) para o Dano Crítico (${cd.toFixed(0)}%). Procure Tiara de Taxa Crítica; a proporção ideal é ~1:2.` })
    } else if (cr > 85) {
      advice.push({ level: 'media', text: `Taxa Crítica em ${cr.toFixed(0)}%, acima do necessário. Troque a Tiara para Dano Crítico.` })
    }
  }

  // talentos
  if (c.talents && c.level >= 70) {
    const target = c.level >= 80 ? 8 : 6
    const low = role.talentPriority.slice(0, 2).filter((t) => c.talents![t] < target)
    if (low.length) {
      advice.push({ level: 'media', text: `Suba os talentos: ${list(low.map((t) => `${TALENT_LABEL[t]} (nv. ${c.talents![t]})`))} — meta nv. ${target}+.` })
    }
  }

  // pior artefato
  const scored = arts.filter((a) => a.rarity === 5).sort((a, b) => a.pct - b.pct)
  if (scored.length === 5 && scored[0].pct < 40) {
    advice.push({ level: 'baixa', text: `Primeiro artefato a substituir: ${SLOT_LABEL[scored[0].slot]} (nota ${scored[0].grade}).` })
  }

  const order = { alta: 0, media: 1, baixa: 2 }
  advice.sort((a, b) => order[a.level] - order[b.level])

  const pct = buildPct(arts)
  return {
    upgradePlan: upgradePlan(arts, role),
    name: role.name,
    weapons,
    artifactSets,
    mainStats: role.mainStats,
    substats: role.substats,
    erTarget: role.erTarget,
    erMin: role.erMin,
    talentPriority: role.talentPriority,
    tips: role.tips && localizeText(role.tips),
    buildPct: pct,
    grade: gradeOf(pct),
    advice,
  }
}

export function analyzeCharacter(c: Character, guide: Guide | undefined, ownedWeapons: Set<string>, weekday = 0): CharacterView {
  const info = characters.get(c.id)!
  const roles = (guide?.roles ?? []).map((r) => analyzeRole(c, r, ownedWeapons))

  // melhor papel = maior qualidade de artefato, com bônus para set e arma que batem
  let bestRole = 0
  let bestScore = -1
  roles.forEach((r, i) => {
    const s = r.buildPct + (r.artifactSets.some((o) => o.matched) ? 15 : 0) +
      (r.weapons.some((w) => w.id === c.weapon?.id) ? 10 : 0)
    if (s > bestScore) { bestScore = s; bestRole = i }
  })

  const weights = guide ? guide.roles[bestRole].substats : GENERIC_WEIGHTS
  const artifacts = c.artifacts.map((a) => scoreArtifact(a, weights, guide?.roles[bestRole]))

  const genericAdvice: Tip[] = []
  if (!guide) {
    genericAdvice.push({ level: 'baixa', text: 'Ainda não há guia curado para este personagem. A nota dos artefatos usa pesos genéricos (Crítico, ATQ%, Vida%, PE, Recarga).' })
    const counts = setCounts(c)
    const has4 = [...counts.values()].some((n) => n >= 4)
    const pairs = [...counts.values()].filter((n) => n >= 2).length
    if (!has4 && pairs < 2) genericAdvice.push({ level: 'media', text: 'Nenhum bônus de set completo: use 4 peças do mesmo set ou 2+2.' })
    const low = c.artifacts.filter((a) => a.rarity === 5 && a.level < 16)
    if (low.length) genericAdvice.push({ level: 'media', text: `${low.length} artefato(s) 5★ abaixo de +16.` })
  }

  const counts = setCounts(c)
  const role = guide?.roles[bestRole]
  const { power, notes: powerNotes } = powerOf(c, roles[bestRole]?.buildPct ?? buildPct(artifacts), role)
  return {
    id: c.id,
    name: info.name,
    element: info.element,
    weaponType: info.weaponType,
    rarity: info.rarity,
    icon: info.icon,
    level: c.level,
    constellation: c.constellation,
    talents: c.talents,
    weapon: c.weapon && { ...ref(weaponInfo, c.weapon.id), level: c.weapon.level, refinement: c.weapon.refinement },
    artifacts: SLOTS.map((s) => artifacts.find((a) => a.slot === s)).filter((a): a is ArtifactView => !!a),
    setCounts: [...counts.entries()].map(([id, count]) => ({ ...ref(setInfo, id), count })).sort((a, b) => b.count - a.count),
    stats: c.stats,
    hasGuide: !!guide,
    guideConfidence: guide?.confidence,
    roles,
    bestRole,
    genericAdvice,
    power,
    powerNotes,
    farm: farmPlan(c, role?.talentPriority, weekday),
    readiness: readinessOf(c, roles[bestRole], role),
  }
}

/** está pronto para o combate? Bloqueios impedem o uso; avisos só reduzem o rendimento. */
export function readinessOf(c: Character, rv: RoleView | undefined, role?: GuideRole): Readiness {
  const blocking: string[] = []
  const warnings: string[] = []
  if (c.level < 70) blocking.push(`Nível ${c.level} (suba para 70+)`)
  else if (c.level < 80) warnings.push(`Nível ${c.level}`)

  const n = c.artifacts.length
  if (n === 0) blocking.push('Sem artefatos')
  else if (n < 3) blocking.push(`Só ${n} de 5 artefatos`)
  else if (n < 5) warnings.push(`${n} de 5 artefatos`)
  else if (rv && rv.buildPct < 25) warnings.push(`Artefatos fracos (nota ${rv.grade})`)

  if (!c.weapon) blocking.push('Sem arma')
  else if (c.weapon.level < 60) blocking.push(`Arma nv. ${c.weapon.level} (suba para 60+)`)
  else if (c.weapon.level < 80) warnings.push(`Arma nv. ${c.weapon.level}`)

  if (c.talents) {
    const main = role?.talentPriority[0] ?? 'skill'
    if (c.talents[main] < 6) warnings.push(`${TALENT_LABEL[main]} nv. ${c.talents[main]}`)
  }
  return { ready: blocking.length === 0, blocking, warnings }
}

/**
 * Força estimada 0..100. Pesos: artefatos 40%, nível 25%, talentos 15%, arma 20%; constelações dão um bônus.
 * Serve para ordenar equipes e escolher quem recebe as melhores peças — não é cálculo de dano.
 */
export function powerOf(c: Character, buildPctValue: number, role?: GuideRole): { power: number; notes: string[] } {
  const notes: string[] = []
  const lvl = c.level >= 90 ? 1 : c.level >= 80 ? 0.88 : c.level >= 70 ? 0.72 : c.level >= 60 ? 0.55 : 0.35
  if (c.level < 80) notes.push(`Nível ${c.level}`)

  let talents = 0.6
  if (c.talents) {
    const main = role?.talentPriority[0] ?? 'skill'
    const lv = c.talents[main]
    talents = Math.min(1, lv / 9)
    if (lv < 6) notes.push(`${TALENT_LABEL[main]} nv. ${lv}`)
  }

  let weapon = 0.3
  if (c.weapon) {
    const info = weaponInfo.get(c.weapon.id)
    const idx = role ? role.weapons.findIndex((w) => weaponByEn(w.name)?.id === c.weapon!.id) : -1
    const fit = idx >= 0 ? Math.max(0.65, 1 - idx * 0.07) : role ? 0.5 : (info?.rarity ?? 4) >= 5 ? 0.85 : 0.65
    const levelF = Math.min(1, c.weapon.level / 90)
    weapon = fit * (0.4 + 0.6 * levelF) * (1 + (c.weapon.refinement - 1) * 0.02)
    if (c.weapon.level < 80) notes.push(`Arma nv. ${c.weapon.level}`)
    if (role && idx === -1) notes.push('Arma fora do guia')
  } else notes.push('Sem arma')

  const rarity = characters.get(c.id)?.rarity ?? 4
  const consBonus = 1 + c.constellation * (rarity >= 5 ? 0.04 : 0.015)
  const raw = (buildPctValue / 100) * 0.4 + lvl * 0.25 + talents * 0.15 + weapon * 0.2
  return { power: Math.round(Math.min(100, raw * consBonus * 100)), notes }
}

export function buildTeams(chars: CharacterView[], teams: TeamGuide[]): TeamView[] {
  const owned = new Map(chars.map((c) => [c.id, c]))
  const out: TeamView[] = []

  for (const t of teams) {
    const carry = characterByEn(t.carry)
    if (!carry || !owned.has(carry.id)) continue

    const used = new Set<string>()
    const members: TeamMemberView[] = t.slots.map((slot) => {
      const ids = slot.map((n) => characterByEn(n)?.id).filter((x): x is string => !!x)
      // prefere a primeira alternativa que ela tem E está pronta; senão, a primeira que ela tem
      const available = (id: string) => owned.has(id) && !used.has(id)
      const readyIdx = ids.findIndex((id) => available(id) && owned.get(id)!.readiness.ready)
      const choice = readyIdx >= 0 ? readyIdx : ids.findIndex(available)
      const id = choice >= 0 ? ids[choice] : ids[0]
      used.add(id)
      const info = characters.get(id)!
      const cv = owned.get(id)
      return {
        id,
        name: info.name,
        icon: info.icon,
        element: info.element,
        rarity: info.rarity,
        owned: choice >= 0,
        choice: Math.max(choice, 0),
        alternatives: ids.filter((x) => x !== id).map((x) => characters.get(x)?.name ?? x),
        replaces: choice > 0
          ? {
              name: characters.get(ids[0])?.name ?? ids[0],
              reason: !owned.has(ids[0]) ? 'nao-tem' : used.has(ids[0]) && ids[0] !== id ? 'em-uso' : 'nao-pronto',
            }
          : undefined,
        buildGrade: cv ? (cv.roles[cv.bestRole]?.grade ?? undefined) : undefined,
        power: cv?.power,
        readiness: cv?.readiness,
      }
    })

    const missing = members.filter((m) => !m.owned).length
    if (missing > 1) continue

    // o carry pesa mais; suportes contam pela força média; alternativas piores e faltas descontam
    const carryPower = owned.get(carry.id)!.power
    const supportPower = members.filter((m) => m.id !== carry.id).reduce((s, m) => s + (m.power ?? 0), 0) / 3
    const power = Math.round((carryPower + supportPower * 3) / 4)
    const preference = members.reduce((s, m) => s + m.choice, 0)
    const score = Math.round(carryPower * 0.55 + supportPower * 0.3 + Math.max(0, 15 - preference * 3) - missing * 40)

    const status: TeamView['status'] = missing > 0 ? 'falta' : members.every((m) => m.readiness?.ready) ? 'pronta' : 'preparar'
    out.push({
      status,
      name: t.name,
      tags: t.tags ?? [],
      members,
      missing,
      carryId: carry.id,
      rotation: t.rotation.map(localizeText),
      notes: t.notes && localizeText(t.notes),
      score,
      power,
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** melhor par de equipes completas sem personagem repetido (Abismo/Teatro) */
export function bestPair(teams: TeamView[]): [number, number] | undefined {
  // prefere equipes prontas; se não houver par pronto, aceita as que só precisam de preparo
  const ready = teams.map((t, i) => ({ t, i })).filter(({ t }) => t.status === 'pronta')
  const pairFrom = (list: { t: TeamView; i: number }[]) => pickPair(list.slice(0, 30))
  return pairFrom(ready) ?? pairFrom(teams.map((t, i) => ({ t, i })).filter(({ t }) => t.missing === 0))
}

function pickPair(complete: { t: TeamView; i: number }[]): [number, number] | undefined {
  let best: [number, number] | undefined
  let bestScore = -Infinity
  for (let a = 0; a < complete.length; a++) {
    const ids = new Set(complete[a].t.members.map((m) => m.id))
    for (let b = a + 1; b < complete.length; b++) {
      if (complete[b].t.members.some((m) => ids.has(m.id))) continue
      const s = complete[a].t.score + complete[b].t.score
      if (s > bestScore) { bestScore = s; best = [complete[a].i, complete[b].i] }
    }
  }
  return best
}

export function analyzeAccount(acc: Account, guides: Map<string, Guide>, teams: TeamGuide[]): AccountView {
  const ownedWeapons = new Set(acc.characters.map((c) => c.weapon?.id).filter((x): x is string => !!x))
  const weekday = gameWeekday(acc.uid)
  const chars = acc.characters
    .map((c) => analyzeCharacter(c, guides.get(c.id), ownedWeapons, weekday))
    .sort((a, b) => b.rarity - a.rarity || b.level - a.level || a.name.localeCompare(b.name))
  const teamViews = buildTeams(chars, teams)
  return {
    uid: acc.uid,
    nickname: acc.nickname,
    level: acc.level,
    worldLevel: acc.worldLevel,
    source: acc.source,
    fetchedAt: acc.fetchedAt,
    warnings: acc.warnings,
    characters: chars,
    teams: teamViews,
    abyssPair: bestPair(teamViews),
    weekday,
  }
}
