import type { Element, SlotKey, StatKey, WeaponType } from './types'
import type { TalentKey } from './guide-types'

export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'Vida', hp_: 'Vida%', atk: 'ATQ', atk_: 'ATQ%', def: 'DEF', def_: 'DEF%',
  eleMas: 'Proficiência Elemental', enerRech_: 'Recarga de Energia', critRate_: 'Taxa Crítica',
  critDMG_: 'Dano Crítico', heal_: 'Bônus de Cura', physical_dmg_: 'Dano Físico',
  pyro_dmg_: 'Dano Pyro', electro_dmg_: 'Dano Electro', hydro_dmg_: 'Dano Hydro',
  dendro_dmg_: 'Dano Dendro', anemo_dmg_: 'Dano Anemo', geo_dmg_: 'Dano Geo', cryo_dmg_: 'Dano Cryo',
}

export const STAT_SHORT: Record<StatKey, string> = {
  ...STAT_LABEL, eleMas: 'PE', enerRech_: 'Recarga', critRate_: 'Taxa Crít.', critDMG_: 'Dano Crít.', heal_: 'Cura',
}

export const isPercent = (k: StatKey) => k.endsWith('_')

export const fmtStat = (k: StatKey, v: number) =>
  isPercent(k) ? `${v.toFixed(1).replace('.', ',')}%` : Math.round(v).toLocaleString('pt-BR')

export const SLOT_LABEL: Record<SlotKey, string> = {
  flower: 'Flor', plume: 'Pena', sands: 'Relógio', goblet: 'Cálice', circlet: 'Tiara',
}

export const TALENT_LABEL: Record<TalentKey, string> = {
  auto: 'Ataque Normal', skill: 'Habilidade Elemental', burst: 'Supremo',
}

export const WEAPON_LABEL: Record<WeaponType, string> = {
  sword: 'Espada', claymore: 'Espadão', polearm: 'Lança', bow: 'Arco', catalyst: 'Catalisador',
}

export const ELEMENT_COLOR: Record<Element, string> = {
  Pyro: '#ef7a35', Hydro: '#4cc2f1', Electro: '#b38dee', Cryo: '#9fd6e3',
  Anemo: '#74c2a8', Geo: '#f0b232', Dendro: '#a5c83b',
}
