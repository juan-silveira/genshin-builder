// Analisador de equipe: recebe 4 personagens da conta e explica se o time funciona e por quê.
// Heurísticas simples e explicáveis: preparo de cada membro, papéis (atacante principal / suporte),
// sobrevivência (cura ou escudo), reações e ressonâncias elementais, e a equipe recomendada mais parecida.
import type { TeamGuide } from '../../shared/guide-types'
import type { Element } from '../../shared/types'
import type { AccountView, CharacterView, TeamCheck, TeamCheckIssue } from '../../shared/view-types'
import { characterByEn, characters } from './gamedata'

/** quem cura ou protege o time (nomes em inglês do jogo) */
const SURVIVAL = new Set([
  'Bennett', 'Sangonomiya Kokomi', 'Zhongli', 'Noelle', 'Diona', 'Layla', 'Thoma', 'Beidou', 'Barbara', 'Qiqi', 'Jean',
  'Kirara', 'Baizhu', 'Yaoyao', 'Charlotte', 'Sigewinne', 'Xilonen', 'Citlali', 'Furina', 'Xianyun', 'Lan Yan', 'Kuki Shinobu',
  'Hu Tao', 'Dehya', 'Candace', 'Mika', 'Gorou', 'Yun Jin', 'Kachina', 'Chiori', 'Navia', 'Escoffier', 'Lynette', 'Iansan',
  'Collei', 'Dori', 'Nahida', 'Bennett', 'Aino', 'Lauma', 'Ifa', 'Yumemizuki Mizuki',
].map((n) => characterByEn(n)?.id).filter((x): x is string => !!x))

const REACTIONS: [Element, Element, string][] = [
  ['Pyro', 'Hydro', 'Vaporizar'], ['Pyro', 'Cryo', 'Derreter'], ['Hydro', 'Cryo', 'Congelar'],
  ['Electro', 'Pyro', 'Sobrecarga'], ['Electro', 'Cryo', 'Supercondução'], ['Electro', 'Hydro', 'Eletrocarregado'],
  ['Dendro', 'Electro', 'Catalisar (Agravar/Propagação)'], ['Dendro', 'Hydro', 'Florescer'], ['Dendro', 'Pyro', 'Queimadura'],
]

const RESONANCE: Partial<Record<Element, string>> = {
  Pyro: 'Ressonância Pyro: +25% ATQ',
  Hydro: 'Ressonância Hydro: +25% Vida',
  Cryo: 'Ressonância Cryo: +15% Taxa Crítica contra inimigos congelados ou com Cryo',
  Electro: 'Ressonância Electro: gera energia extra em reações',
  Geo: 'Ressonância Geo: +15% de dano e redução de RES Geo com escudo',
  Anemo: 'Ressonância Anemo: habilidades recarregam 5% mais rápido',
  Dendro: 'Ressonância Dendro: +50 a +100 de Proficiência Elemental',
}

type Role = 'principal' | 'sub' | 'suporte' | 'desconhecido'
const roleOf = (c: CharacterView): Role => {
  const name = c.roles[c.bestRole]?.name.toLowerCase() ?? ''
  if (!name) return 'desconhecido'
  if (name.includes('dps principal') || name === 'dps') return 'principal'
  if (name.includes('sub-dps') || name.includes('sub dps')) return 'sub'
  return 'suporte'
}

const joinE = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`)

const reacts = (a?: Element, b?: Element) =>
  !!a && !!b && (a === 'Anemo' || b === 'Anemo' || a === 'Geo' || b === 'Geo'
    ? false
    : REACTIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))

export function checkTeam(view: AccountView, ids: string[], teams: TeamGuide[]): TeamCheck {
  const byId = new Map(view.characters.map((c) => [c.id, c]))
  const members = ids.map((id) => byId.get(id)).filter((c): c is CharacterView => !!c)
  const issues: TeamCheckIssue[] = []
  const good: string[] = []

  if (members.length < 4) issues.push({ level: 'alta', text: `O time tem ${members.length} personagens; o Abismo e os desafios pedem 4.` })

  // preparo de cada membro
  for (const m of members) {
    if (!m.readiness.ready) issues.push({ level: 'alta', text: `${m.name} não está pronto: ${m.readiness.blocking.join(', ')}.`, charId: m.id })
    else if (m.readiness.warnings.length) issues.push({ level: 'baixa', text: `${m.name}: ${m.readiness.warnings.join(', ')}.`, charId: m.id })
  }

  // papéis
  const roles = new Map(members.map((m) => [m.id, roleOf(m)]))
  const mains = members.filter((m) => roles.get(m.id) === 'principal')
  const supports = members.filter((m) => roles.get(m.id) === 'suporte')
  if (members.length >= 3 && mains.length === 0 && !members.some((m) => roles.get(m.id) === 'sub')) {
    issues.push({ level: 'alta', text: 'Ninguém aqui é atacante principal: o time causa pouco dano. Coloque um DPS principal.' })
  } else if (mains.length >= 2) {
    issues.push({
      level: 'media',
      text: `${joinE(mains.map((m) => m.name))} são atacantes principais: todos precisam ficar em campo e disputam o tempo. Deixe só um e troque ${mains.length > 2 ? 'os outros' : 'o outro'} por suporte.`,
    })
  }
  if (members.length >= 4 && supports.length === 0) {
    issues.push({ level: 'media', text: 'Nenhum suporte puro: ninguém fortalece o atacante (bônus de ATQ, redução de resistência, bateria de energia).' })
  }

  // sobrevivência
  const keepers = members.filter((m) => SURVIVAL.has(m.id.split('-')[0]))
  if (members.length >= 4 && keepers.length === 0) {
    // sugere quem ela tem e já está pronto; se ninguém estiver, cita quem ela tem
    const own = view.characters.filter((c) => SURVIVAL.has(c.id.split('-')[0]) && !ids.includes(c.id))
    const readyOwn = own.filter((c) => c.readiness.ready).sort((a, b) => b.power - a.power).slice(0, 4)
    const names = (readyOwn.length ? readyOwn : own.slice(0, 4)).map((c) => c.name)
    issues.push({
      level: 'alta',
      text: `Sem cura nem escudo: no Abismo e em chefes o time morre rápido. ${
        names.length ? `Dos seus personagens${readyOwn.length ? ' prontos' : ''}, inclua ${joinE(names).replace(/ e ([^,]+)$/, ' ou $1')}.` : 'Inclua alguém que cure ou proteja.'
      }`,
    })
  } else if (keepers.length) {
    good.push(`Sobrevivência: ${joinE(keepers.map((m) => m.name))} ${keepers.length > 1 ? 'curam ou protegem' : 'cura ou protege'} o time.`)
  }

  // elementos: reações e ressonâncias
  const els = members.map((m) => m.element).filter((e): e is Element => !!e)
  const reactions = new Set<string>()
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const r = REACTIONS.find(([x, y]) => (x === els[i] && y === els[j]) || (x === els[j] && y === els[i]))
      if (r) reactions.add(r[2])
    }
  }
  if (els.includes('Anemo') && els.some((e) => e !== 'Anemo' && e !== 'Geo')) reactions.add('Redemoinho (agrupa inimigos e reduz resistência com Sombra Verde)')
  if (els.includes('Geo') && els.some((e) => e !== 'Anemo' && e !== 'Geo')) reactions.add('Cristalizar (escudos)')
  if (reactions.size) good.push(`Reações possíveis: ${[...reactions].join(', ')}.`)

  const counts = new Map<Element, number>()
  for (const e of els) counts.set(e, (counts.get(e) ?? 0) + 1)
  for (const [e, n] of counts) if (n >= 2 && RESONANCE[e]) good.push(`${RESONANCE[e]}.`)
  if (els.length === 4 && counts.size === 4) issues.push({ level: 'baixa', text: '4 elementos diferentes: sem bônus de ressonância elemental.' })

  for (const m of mains) {
    const e = m.element
    if (!e || e === 'Anemo' || e === 'Geo') continue
    const partner = members.some((o) => o.id !== m.id && reacts(e, o.element))
    if (!partner) {
      issues.push({
        level: 'media',
        text: `${m.name} (${e}) não tem ninguém no time para causar reação com o elemento dele, e perde muito dano.`,
        charId: m.id,
      })
    }
  }

  // equipe recomendada mais parecida
  let suggestion: TeamCheck['suggestion']
  const chosen = new Set(ids)
  let bestOverlap = 0
  for (const t of teams) {
    const slots = t.slots.map((s) => s.map((n) => characterByEn(n)?.id).filter((x): x is string => !!x))
    const matched = slots.map((s) => s.find((id) => chosen.has(id)))
    const overlap = matched.filter(Boolean).length
    if (overlap < 3 || overlap <= bestOverlap) continue
    bestOverlap = overlap
    if (overlap === 4) {
      suggestion = { team: t.name, swaps: [] }
      continue
    }
    const freeSlot = matched.findIndex((x) => !x)
    const outId = ids.find((id) => !matched.includes(id))
    const options = slots[freeSlot].filter((id) => byId.has(id) && !chosen.has(id))
    const ready = options.filter((id) => byId.get(id)!.readiness.ready)
    const pick = ready[0] ?? options[0]
    suggestion = {
      team: t.name,
      swaps: outId ? [{
        out: byId.get(outId)?.name ?? characters.get(outId)?.name ?? outId,
        in: pick ? byId.get(pick)!.name : slots[freeSlot].map((id) => characters.get(id)?.name ?? id).join(' ou '),
        owned: !!pick,
      }] : [],
    }
  }
  if (suggestion?.swaps.length === 0) good.push(`É a equipe recomendada "${suggestion.team}".`)

  const high = issues.filter((i) => i.level === 'alta').length
  const mid = issues.filter((i) => i.level === 'media').length
  const verdict: TeamCheck['verdict'] = high ? 'nao' : mid ? 'ressalvas' : 'funciona'
  const order = { alta: 0, media: 1, baixa: 2 }
  issues.sort((a, b) => order[a.level] - order[b.level])

  return {
    members: members.map((m) => ({
      id: m.id, name: m.name, icon: m.icon, element: m.element, rarity: m.rarity,
      role: roles.get(m.id)!, ready: m.readiness.ready, grade: m.artifacts.length ? m.roles[m.bestRole]?.grade : undefined,
    })),
    verdict, issues, good, suggestion,
  }
}
