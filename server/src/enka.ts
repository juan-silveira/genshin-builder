// Leitura da Vitrine de Personagens pelo Enka.Network. Só precisa do UID — nenhuma credencial.
import type { Account, Artifact, Character, StatKey } from '../../shared/types'
import { characters, relicSetId, skillOrder } from './gamedata'
import { ENKA_SLOTS, FINAL_PROPS, STRING_PROPS } from './props'

const UA = 'genshin-builder/0.1 (uso pessoal)'

export class EnkaError extends Error {}

const ENKA_ERRORS: Record<number, string> = {
  400: 'UID inválido.',
  404: 'UID não encontrado.',
  424: 'O jogo está em manutenção ou o Enka está atualizando. Tente mais tarde.',
  429: 'Muitas consultas seguidas ao Enka. Espere alguns minutos.',
  500: 'O Enka está com problemas. Tente mais tarde.',
  503: 'O Enka está fora do ar. Tente mais tarde.',
}

export async function fetchEnka(uid: string): Promise<Account & { ttl: number }> {
  const res = await fetch(`https://enka.network/api/uid/${uid}/`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new EnkaError(ENKA_ERRORS[res.status] ?? `Erro do Enka (HTTP ${res.status}).`)
  const data = await res.json()
  const info = data.playerInfo ?? {}
  const list: any[] = data.avatarInfoList ?? []

  const warnings: string[] = []
  if (!list.length) {
    warnings.push(
      'A Vitrine de Personagens está vazia ou com "Mostrar detalhes" desativado. No jogo: Menu › Perfil › Vitrine de Personagens — adicione personagens e ative "Mostrar detalhes do personagem".',
    )
  }

  return {
    uid,
    nickname: info.nickname ?? uid,
    level: info.level,
    worldLevel: info.worldLevel,
    source: 'enka',
    fetchedAt: new Date().toISOString(),
    characters: list.map(normalizeAvatar).filter((c): c is Character => !!c),
    warnings,
    ttl: data.ttl ?? 60,
  }
}

function normalizeAvatar(a: any): Character | undefined {
  let id = String(a.avatarId)
  if (!characters.has(id) && a.skillDepotId) id = `${id}-${a.skillDepotId}` // Viajante
  if (!characters.has(id)) return undefined

  const stats: Character['stats'] = {}
  for (const [k, v] of Object.entries(a.fightPropMap ?? {})) {
    const key = FINAL_PROPS[Number(k)]
    if (!key) continue
    stats[key] = ['hp', 'atk', 'def', 'eleMas'].includes(key) ? Number(v) : Number(v) * 100
  }

  let weapon: Character['weapon']
  const artifacts: Artifact[] = []
  for (const eq of a.equipList ?? []) {
    if (eq.weapon) {
      const affix = Object.values(eq.weapon.affixMap ?? {})[0]
      weapon = {
        id: String(eq.itemId),
        level: eq.weapon.level,
        ascension: eq.weapon.promoteLevel ?? 0,
        refinement: (Number(affix) || 0) + 1,
        rarity: eq.flat?.rankLevel ?? 0,
        icon: eq.flat?.icon ? `https://enka.network/ui/${eq.flat.icon}.png` : undefined,
      }
    } else if (eq.reliquary) {
      const slot = ENKA_SLOTS[eq.flat?.equipType]
      const main = eq.flat?.reliquaryMainstat
      if (!slot || !main) continue
      artifacts.push({
        setId: relicSetId(eq.itemId) ?? '',
        slot,
        rarity: eq.flat.rankLevel,
        level: (eq.reliquary.level ?? 1) - 1,
        mainStat: STRING_PROPS[main.mainPropId],
        mainValue: main.statValue,
        substats: (eq.flat.reliquarySubstats ?? [])
          .map((s: any) => ({ key: STRING_PROPS[s.appendPropId] as StatKey, value: s.statValue }))
          .filter((s: any) => s.key),
        icon: `https://enka.network/ui/${eq.flat.icon}.png`,
      })
    }
  }

  const order = skillOrder(id)
  const lv = (i: number) => a.skillLevelMap?.[order[i]] ?? 1

  return {
    id,
    level: Number(a.propMap?.['4001']?.val ?? 1),
    ascension: Number(a.propMap?.['1002']?.val ?? 0),
    constellation: a.talentIdList?.length ?? 0,
    talents: order.length >= 3 ? { auto: lv(0), skill: lv(1), burst: lv(2) } : undefined,
    weapon,
    artifacts,
    stats,
  }
}
