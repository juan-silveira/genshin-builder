// Tela "Hoje": o que dá para farmar no dia para os personagens que importam, mais as Notas em Tempo Real.
import type { AccountView, CharacterView, DailyNote, TodayView } from '../../shared/view-types'
import { WEEKDAYS } from './farm'

/** personagens das melhores equipes completas (e da dupla do Abismo) */
export function focusCharacters(view: AccountView, topTeams = 6): CharacterView[] {
  const byId = new Map(view.characters.map((c) => [c.id, c]))
  const picked = view.teams.filter((t) => t.missing === 0).slice(0, topTeams)
  if (view.abyssPair) picked.push(view.teams[view.abyssPair[0]], view.teams[view.abyssPair[1]])
  const ids = new Set(picked.flatMap((t) => t.members.filter((m) => m.owned).map((m) => m.id)))
  return [...ids].map((id) => byId.get(id)).filter((c): c is CharacterView => !!c)
}

export function buildToday(view: AccountView, note?: DailyNote, noteError?: string): TodayView {
  const focus = focusCharacters(view)
  const groups = new Map<string, Map<number, TodayView['farmToday'][number]['materials'][number]>>()
  const weekly = new Map<number, TodayView['weekly'][number]>()

  for (const c of focus) {
    const who = { id: c.id, name: c.name, icon: c.icon }
    for (const m of c.farm?.materials ?? []) {
      if (m.category === 'dominio' && m.availableToday) {
        const g = groups.get(m.where) ?? new Map()
        const cur = g.get(m.id) ?? { name: m.name, icon: m.icon, mapUrl: m.mapUrl, count: 0, forChars: [] }
        cur.count += m.count
        cur.forChars.push(who)
        g.set(m.id, cur)
        groups.set(m.where, g)
      } else if (m.category === 'semanal') {
        const cur = weekly.get(m.id) ?? { name: m.name, icon: m.icon, count: 0, where: m.where, mapUrl: m.mapUrl, forChars: [] }
        cur.count += m.count
        cur.forChars.push(c.name)
        weekly.set(m.id, cur)
      }
    }
  }

  return {
    weekday: view.weekday,
    weekdayName: WEEKDAYS[view.weekday],
    note,
    noteError,
    farmToday: [...groups.entries()]
      .map(([where, mats]) => ({ where, materials: [...mats.values()].sort((a, b) => b.forChars.length - a.forChars.length) }))
      .sort((a, b) => b.materials.reduce((s, m) => s + m.forChars.length, 0) - a.materials.reduce((s, m) => s + m.forChars.length, 0)),
    weekly: [...weekly.values()].sort((a, b) => b.forChars.length - a.forChars.length),
    focus: focus.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  }
}
