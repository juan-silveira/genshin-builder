// Modelo normalizado da conta, independente da fonte (Enka ou HoYoLAB).
// As chaves de atributo seguem o formato GOOD do Genshin Optimizer.

export type StatKey =
  | 'hp' | 'hp_' | 'atk' | 'atk_' | 'def' | 'def_'
  | 'eleMas' | 'enerRech_' | 'critRate_' | 'critDMG_' | 'heal_'
  | 'physical_dmg_' | 'pyro_dmg_' | 'electro_dmg_' | 'hydro_dmg_'
  | 'dendro_dmg_' | 'anemo_dmg_' | 'geo_dmg_' | 'cryo_dmg_'

export type SlotKey = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet'
export const SLOTS: SlotKey[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']

export type Element = 'Pyro' | 'Hydro' | 'Electro' | 'Cryo' | 'Anemo' | 'Geo' | 'Dendro'
export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst'

export interface Artifact {
  setId: string
  slot: SlotKey
  rarity: number
  level: number
  mainStat: StatKey
  mainValue: number
  substats: { key: StatKey; value: number }[]
  icon?: string
}

export interface Weapon {
  id: string
  level: number
  /** fase de ascensão 0..6 */
  ascension?: number
  refinement: number
  rarity: number
  icon?: string
}

export interface Character {
  /** id do avatar no jogo (ex.: "10000052"); Viajante usa "10000007-504" etc. */
  id: string
  level: number
  /** fase de ascensão 0..6 (quando a fonte informa) */
  ascension?: number
  constellation: number
  talents?: { auto: number; skill: number; burst: number }
  weapon?: Weapon
  artifacts: Artifact[]
  /** atributos finais (percentuais em pontos, ex.: critRate_ = 65.2) */
  stats: Partial<Record<StatKey, number>>
}

export interface Account {
  uid: string
  nickname: string
  level?: number
  worldLevel?: number
  source: 'enka' | 'hoyolab'
  fetchedAt: string
  characters: Character[]
  /** avisos para mostrar na tela (ex.: vitrine fechada) */
  warnings: string[]
}
