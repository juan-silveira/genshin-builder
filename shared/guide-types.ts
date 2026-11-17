// Formato dos guias curados (data/guides/*.json).
// Personagens, armas e sets são referenciados pelo NOME EM INGLÊS exatamente como no jogo;
// `npm run validate-data` confere tudo contra os dados do Enka e os nomes em PT vêm de lá.
import type { StatKey } from './types'

export type TalentKey = 'auto' | 'skill' | 'burst'

export interface GuideRole {
  /** ex.: "DPS principal", "Suporte/Bateria" */
  name: string
  weapons: { name: string; note?: string }[]
  /** cada opção é uma combinação: 4 peças de um set, ou 2+2 */
  artifactSets: { sets: { name: string; pieces: 2 | 4 }[]; note?: string }[]
  mainStats: { sands: StatKey[]; goblet: StatKey[]; circlet: StatKey[] }
  /** peso 0..1 de cada substatus para este papel */
  substats: Partial<Record<StatKey, number>>
  /** meta de Recarga de Energia, ex.: "160–180%" */
  erTarget?: string
  /** meta numérica mínima de ER para alertas (em %, ex.: 160) */
  erMin?: number
  talentPriority: TalentKey[]
  tips?: string
}

export interface Guide {
  character: string
  /** confiança no guia; personagens muito novos ainda têm builds instáveis */
  confidence?: 'alta' | 'media' | 'baixa'
  roles: GuideRole[]
}

export interface TeamGuide {
  /** nome da equipe em PT, ex.: "Raiden Nacional" */
  name: string
  /** cada slot lista alternativas em ordem de preferência; "*Anemo" etc. não são permitidos */
  slots: string[][]
  /** papel do personagem principal da equipe (nome em inglês) */
  carry: string
  tags?: string[]
  /** rotação passo a passo em PT */
  rotation: string[]
  notes?: string
}
