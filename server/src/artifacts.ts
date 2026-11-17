// Menu de artefatos: cada peça equipada, com quem está e com quem deveria estar.
// Reaproveita o otimizador na conta toda: personagens das melhores equipes escolhem primeiro, depois os
// demais com guia, pela força. Quem não tem guia, ou ainda não está em nível de combate, não pede peças.
import type { Guide } from '../../shared/guide-types'
import { SLOT_LABEL } from '../../shared/labels'
import type { Account } from '../../shared/types'
import type { AccountView, ArtifactRow, ArtifactsView, SetSummary } from '../../shared/view-types'
import { setDomain } from './farm'
import { setByEn, setInfo } from './gamedata'
import { optimizeTeams } from './optimizer'
import { focusCharacters } from './today'

export function buildArtifacts(acc: Account, view: AccountView, guides: Map<string, Guide>): ArtifactsView {
  const byId = new Map(view.characters.map((c) => [c.id, c]))
  const focus = new Set(focusCharacters(view).map((c) => c.id))
  // só recebe peças quem já dá para usar (nível 70+ e arma 60+); artefato em personagem nível 20 é desperdício
  const level = new Map(acc.characters.map((c) => [c.id, c]))
  const eligible = (id: string) => {
    const c = level.get(id)!
    return c.level >= 70 && (c.weapon?.level ?? 0) >= 60
  }
  const order = [...view.characters]
    .filter((c) => guides.has(c.id) && eligible(c.id))
    .sort((a, b) => Number(focus.has(b.id)) - Number(focus.has(a.id)) || b.power - a.power)
    .map((c) => c.id)

  // na conta toda, só sugere quando o conjunto do personagem melhora bastante (evita dança de peças fracas)
  const result = optimizeTeams(acc, guides, order, 8)
  // mostra só as trocas de quem melhora de verdade: +15 pontos de nota ou passa a ter o bônus de set
  const worth = new Set(result.members
    .filter((m) => m.after.pct - m.before.pct >= 15 || (!!m.after.set && !m.before.set))
    .map((m) => m.id))
  const moveOf = new Map(result.artifactMoves.filter((m) => worth.has(m.to)).map((m) => [`${m.from}:${m.slot}`, m.to]))
  const gainOf = new Map(result.members.map((m) => [m.id, m]))

  const artifacts: ArtifactRow[] = []
  for (const c of acc.characters) {
    const cv = byId.get(c.id)!
    for (const a of c.artifacts) {
      const scored = cv.artifacts.find((x) => x.slot === a.slot)
      const to = moveOf.get(`${c.id}:${a.slot}`)
      const target = to ? byId.get(to) : undefined
      artifacts.push({
        key: `${c.id}:${a.slot}`,
        slot: a.slot,
        slotName: SLOT_LABEL[a.slot],
        set: { id: a.setId, name: setInfo.get(a.setId)?.name ?? '?', icon: setInfo.get(a.setId)?.icon },
        rarity: a.rarity,
        level: a.level,
        mainStat: a.mainStat,
        mainValue: a.mainValue,
        substats: a.substats,
        holder: { id: cv.id, name: cv.name, icon: cv.icon },
        grade: cv.hasGuide ? scored?.grade : undefined,
        critValue: scored?.critValue ?? 0,
        mainStatOk: scored?.mainStatOk ?? null,
        bestFor: target && {
          id: target.id, name: target.name, icon: target.icon,
          from: gainOf.get(target.id)!.before.grade, to: gainOf.get(target.id)!.after.grade,
          fromPct: gainOf.get(target.id)!.before.pct, toPct: gainOf.get(target.id)!.after.pct,
        },
        ok: !target,
      })
    }
  }
  const slotOrder = ['flower', 'plume', 'sands', 'goblet', 'circlet']
  artifacts.sort((a, b) => Number(a.ok) - Number(b.ok) || a.holder.name.localeCompare(b.holder.name) || slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot))

  // resumo por set: quantas peças e quem precisa dele
  const count = new Map<string, number>()
  for (const a of artifacts) count.set(a.set.id, (count.get(a.set.id) ?? 0) + 1)
  const wanted = new Map<string, Set<string>>()
  for (const cv of view.characters) {
    const role = guides.get(cv.id)?.roles[cv.bestRole]
    for (const opt of role?.artifactSets.slice(0, 2) ?? []) {
      for (const s of opt.sets) {
        const id = setByEn(s.name)?.id
        if (!id) continue
        if (!wanted.has(id)) wanted.set(id, new Set())
        wanted.get(id)!.add(cv.name)
      }
    }
  }
  const ids = new Set([...count.keys(), ...wanted.keys()])
  const sets: SetSummary[] = [...ids].map((id) => {
    const d = setDomain(id)
    return {
      id,
      name: setInfo.get(id)?.name ?? id,
      icon: setInfo.get(id)?.icon,
      pieces: count.get(id) ?? 0,
      where: d?.domain && `${d.domain} — ${d.entrance} (${d.region})`,
      recommendedFor: [...(wanted.get(id) ?? [])],
    }
  }).sort((a, b) => b.recommendedFor.length - a.recommendedFor.length || b.pieces - a.pieces)

  return { artifacts, moves: artifacts.filter((a) => !a.ok).length, sets }
}
