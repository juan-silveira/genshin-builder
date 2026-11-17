// Dados de farm gerados do genshin-db (data/gamedb/farm.json).

export interface Cost { id: number; count: number }

export interface MaterialInfo {
  name: string
  rarity?: number
  type?: string
  domain?: string
  entrance?: string
  region?: string
  /** dias da semana em PT, ex.: "Segunda-feira" */
  days?: string[]
  sources: string[]
  icon?: string
  /** marcador no mapa interativo oficial da HoYoLAB (shown_types) */
  mapLabel?: number
}

export interface FarmData {
  characters: Record<string, {
    /** custo de cada uma das 6 ascensões */
    ascend: Cost[][]
    ascendMora: number[]
    /** custo de cada nível de talento 2..10 (índice 0 = nível 2) */
    talent: Cost[][]
    talentMora: number[]
  }>
  weapons: Record<string, { ascend: Cost[][] }>
  sets: Record<string, { domain?: string; entrance?: string; region?: string }>
  materials: Record<string, MaterialInfo>
}
