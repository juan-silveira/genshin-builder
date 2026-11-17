// Tradução dos códigos de atributo do jogo para as chaves StatKey.
import type { SlotKey, StatKey } from '../../shared/types'

/** códigos numéricos (FightProp) — usados pelo fightPropMap do Enka e pelo property_type da HoYoLAB */
export const NUMERIC_PROPS: Record<number, StatKey> = {
  2: 'hp', 3: 'hp_', 5: 'atk', 6: 'atk_', 8: 'def', 9: 'def_',
  20: 'critRate_', 22: 'critDMG_', 23: 'enerRech_', 26: 'heal_', 28: 'eleMas',
  30: 'physical_dmg_', 40: 'pyro_dmg_', 41: 'electro_dmg_', 42: 'hydro_dmg_',
  43: 'dendro_dmg_', 44: 'anemo_dmg_', 45: 'geo_dmg_', 46: 'cryo_dmg_',
}

/** atributos finais do personagem (vida/ataque/defesa totais) */
export const FINAL_PROPS: Record<number, StatKey> = {
  2000: 'hp', 2001: 'atk', 2002: 'def',
  20: 'critRate_', 22: 'critDMG_', 23: 'enerRech_', 26: 'heal_', 28: 'eleMas',
  30: 'physical_dmg_', 40: 'pyro_dmg_', 41: 'electro_dmg_', 42: 'hydro_dmg_',
  43: 'dendro_dmg_', 44: 'anemo_dmg_', 45: 'geo_dmg_', 46: 'cryo_dmg_',
}

/** códigos em texto usados nos artefatos do Enka */
export const STRING_PROPS: Record<string, StatKey> = {
  FIGHT_PROP_HP: 'hp', FIGHT_PROP_HP_PERCENT: 'hp_',
  FIGHT_PROP_ATTACK: 'atk', FIGHT_PROP_ATTACK_PERCENT: 'atk_',
  FIGHT_PROP_DEFENSE: 'def', FIGHT_PROP_DEFENSE_PERCENT: 'def_',
  FIGHT_PROP_ELEMENT_MASTERY: 'eleMas', FIGHT_PROP_CHARGE_EFFICIENCY: 'enerRech_',
  FIGHT_PROP_CRITICAL: 'critRate_', FIGHT_PROP_CRITICAL_HURT: 'critDMG_',
  FIGHT_PROP_HEAL_ADD: 'heal_', FIGHT_PROP_PHYSICAL_ADD_HURT: 'physical_dmg_',
  FIGHT_PROP_FIRE_ADD_HURT: 'pyro_dmg_', FIGHT_PROP_ELEC_ADD_HURT: 'electro_dmg_',
  FIGHT_PROP_WATER_ADD_HURT: 'hydro_dmg_', FIGHT_PROP_GRASS_ADD_HURT: 'dendro_dmg_',
  FIGHT_PROP_WIND_ADD_HURT: 'anemo_dmg_', FIGHT_PROP_ROCK_ADD_HURT: 'geo_dmg_',
  FIGHT_PROP_ICE_ADD_HURT: 'cryo_dmg_',
}

export const ENKA_SLOTS: Record<string, SlotKey> = {
  EQUIP_BRACER: 'flower', EQUIP_NECKLACE: 'plume', EQUIP_SHOES: 'sands', EQUIP_RING: 'goblet', EQUIP_DRESS: 'circlet',
}
export const HOYOLAB_SLOTS: Record<number, SlotKey> = { 1: 'flower', 2: 'plume', 3: 'sands', 4: 'goblet', 5: 'circlet' }

/** "4.7%" → 4.7 ; "1,234" → 1234 */
export const parseValue = (v: string | number) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[,%\s]/g, '')) || 0)
