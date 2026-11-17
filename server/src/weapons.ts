// Menu de armas: cada arma equipada na conta, com quem está e com quem deveria estar.
// Distribuição gulosa: os personagens das melhores equipes escolhem primeiro (depois os demais, pela força);
// cada um pega a melhor arma do seu tipo que esteja no próprio guia. Quem não tem guia fica com a própria arma.
import type { Guide } from '../../shared/guide-types'
import type { Account } from '../../shared/types'
import type { AccountView, WeaponRow, WeaponsView } from '../../shared/view-types'
import { characters, weaponByEn, weaponInfo } from './gamedata'
import { weaponValue } from './optimizer'
import { focusCharacters } from './today'

export function buildWeapons(acc: Account, view: AccountView, guides: Map<string, Guide>): WeaponsView {
  const byId = new Map(view.characters.map((c) => [c.id, c]))
  const focus = new Set(focusCharacters(view).map((c) => c.id))
  const order = [...view.characters]
    .filter((c) => guides.has(c.id))
    .sort((a, b) => Number(focus.has(b.id)) - Number(focus.has(a.id)) || b.power - a.power)

  // arma de cada personagem (chave = dono atual, pois a mesma arma pode existir em cópias)
  const pool = new Map(acc.characters.filter((c) => c.weapon).map((c) => [c.id, c.weapon!]))
  const assigned = new Map<string, string>() // dono atual da arma → quem deveria usar

  for (const cv of order) {
    const guide = guides.get(cv.id)!
    const role = guide.roles[cv.bestRole]
    const type = characters.get(cv.id)?.weaponType
    let bestOwner: string | undefined
    let bestV = -Infinity
    const listed = new Set(role.weapons.map((x) => weaponByEn(x.name)?.id))
    for (const [owner, w] of pool) {
      if (weaponInfo.get(w.id)?.type !== type) continue
      // só pede a arma de outro personagem se ela estiver no guia; a própria sempre conta
      if (owner !== cv.id && !listed.has(w.id)) continue
      // pequena preferência por manter a própria arma (evita trocas por diferença mínima)
      const v = weaponValue(w.id, w.level, w.refinement, role) + (owner === cv.id ? 0.5 : 0)
      if (v > bestV) { bestV = v; bestOwner = owner }
    }
    if (!bestOwner) continue
    pool.delete(bestOwner)
    assigned.set(bestOwner, cv.id)
  }

  const weapons: WeaponRow[] = acc.characters.filter((c) => c.weapon).map((c) => {
    const w = c.weapon!
    const info = weaponInfo.get(w.id)
    const holder = byId.get(c.id)!
    const target = assigned.get(c.id)
    const recommendedFor = view.characters
      .map((cv) => {
        const role = guides.get(cv.id)?.roles[cv.bestRole]
        const rank = role ? role.weapons.findIndex((x) => weaponByEn(x.name)?.id === w.id) : -1
        return { id: cv.id, name: cv.name, rank: rank + 1 }
      })
      .filter((r) => r.rank > 0)
      .sort((a, b) => a.rank - b.rank)
    const moveTo = target && target !== c.id ? byId.get(target) : undefined
    const rank = moveTo ? recommendedFor.find((r) => r.id === moveTo.id)?.rank : undefined
    return {
      key: c.id,
      id: w.id,
      name: info?.name ?? w.id,
      icon: info?.icon,
      rarity: info?.rarity ?? w.rarity,
      type: info?.type,
      level: w.level,
      refinement: w.refinement,
      holder: { id: holder.id, name: holder.name, icon: holder.icon },
      bestFor: moveTo && {
        id: moveTo.id,
        name: moveTo.name,
        icon: moveTo.icon,
        reason: `${rank}ª opção do guia de ${moveTo.name}${focus.has(moveTo.id) ? ', que está nas suas melhores equipes' : ''}`,
      },
      recommendedFor,
      ok: !moveTo,
    }
  })

  // primeiro as que devem mudar, depois por raridade e nível
  weapons.sort((a, b) => Number(a.ok) - Number(b.ok) || b.rarity - a.rarity || b.level - a.level || a.name.localeCompare(b.name))
  return { weapons, moves: weapons.filter((w) => !w.ok).length }
}
