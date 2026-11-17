// Dados estáticos do jogo vindos do Enka (data/enka, baixados com `npm run update-data`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Element, WeaponType } from '../../shared/types'
import { DATA } from './paths'

const DIR = join(DATA, 'enka')
const load = (f: string) => JSON.parse(readFileSync(join(DIR, `${f}.json`), 'utf8'))

const avatars: Record<string, any> = load('avatars')
const locs: Record<string, Record<string, string>> = load('locs')
const weapons: Record<string, any> = load('weapons')
const relics: { Items: Record<string, any>; Sets: Record<string, any> } = load('relics')

const pt = locs.pt
const en = locs.en

const icon = (path?: string) => (path ? `https://enka.network${path}` : undefined)

const ELEMENTS: Record<string, Element> = {
  Fire: 'Pyro', Water: 'Hydro', Electric: 'Electro', Ice: 'Cryo', Wind: 'Anemo', Rock: 'Geo', Grass: 'Dendro',
}
const AVATAR_WEAPON: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: 'sword', WEAPON_CLAYMORE: 'claymore', WEAPON_POLE: 'polearm',
  WEAPON_BOW: 'bow', WEAPON_CATALYST: 'catalyst',
}
const WEAPON_TYPE_NUM: Record<number, WeaponType> = { 1: 'sword', 2: 'claymore', 3: 'bow', 4: 'polearm', 5: 'catalyst' }

export interface CharInfo {
  id: string
  name: string
  nameEn: string
  element?: Element
  weaponType?: WeaponType
  rarity: number
  icon?: string
}
export interface WeaponInfo { id: string; name: string; nameEn: string; type: WeaponType; rarity: number; icon?: string }
export interface SetInfo { id: string; name: string; nameEn: string; icon?: string }

export const characters = new Map<string, CharInfo>()
for (const [id, v] of Object.entries(avatars)) {
  if (!v.NameTextMapHash || !v.Element || v.Element === 'None') continue
  const nameEn = en[v.NameTextMapHash]
  const element = ELEMENTS[v.Element]
  // Viajante/Manequim: um id por elemento; o nome inclui o elemento para diferenciar.
  const isVariant = id.includes('-')
  characters.set(id, {
    id,
    name: isVariant ? `${pt[v.NameTextMapHash]} (${element})` : pt[v.NameTextMapHash] ?? nameEn,
    nameEn: isVariant ? `${nameEn} (${element})` : nameEn,
    element,
    weaponType: AVATAR_WEAPON[v.WeaponType],
    rarity: v.QualityType?.startsWith('QUALITY_ORANGE') ? 5 : 4,
    icon: icon(v.SideIconName?.replace('_Side', '')),
  })
}

export const weaponInfo = new Map<string, WeaponInfo>()
for (const [id, v] of Object.entries(weapons)) {
  const nameEn = en[v.NameTextMapHash]
  if (!nameEn) continue
  weaponInfo.set(id, {
    id, nameEn, name: pt[v.NameTextMapHash] ?? nameEn,
    type: WEAPON_TYPE_NUM[v.WeaponType], rarity: v.Rarity, icon: icon(v.Icon),
  })
}

export const setInfo = new Map<string, SetInfo>()
const setIcons = new Map<string, string>()
for (const item of Object.values(relics.Items)) {
  if (item.SetId && !setIcons.has(String(item.SetId))) setIcons.set(String(item.SetId), item.Icon)
}
for (const [id, v] of Object.entries(relics.Sets)) {
  const nameEn = en[v.Name]
  if (!nameEn) continue
  setInfo.set(id, { id, nameEn, name: pt[v.Name] ?? nameEn, icon: icon(setIcons.get(id)) })
}

const byEn = <T extends { nameEn: string }>(m: Map<string, T>) => {
  const idx = new Map<string, T>()
  // em caso de nomes repetidos (ex.: armas de evento), fica o de maior id = mais recente
  for (const v of [...m.values()].sort((a: any, b: any) => (a.id < b.id ? -1 : 1))) idx.set(v.nameEn.toLowerCase(), v)
  return (name: string) => idx.get(name.toLowerCase())
}
export const characterByEn = byEn(characters)
export const weaponByEn = byEn(weaponInfo)
export const setByEn = byEn(setInfo)

/** nome de set a partir do nome em PT (a HoYoLAB devolve nomes localizados) */
const setPtIdx = new Map([...setInfo.values()].map((s) => [s.name.toLowerCase(), s]))
export const setByPt = (name: string) => setPtIdx.get(name.toLowerCase())

export const relicSetId = (itemId: number | string): string | undefined => {
  const setId = relics.Items[String(itemId)]?.SetId
  return setId ? String(setId) : undefined
}

/** ids das habilidades na ordem [ataque normal, habilidade elemental, supremo] */
export const skillOrder = (charId: string): number[] => avatars[charId]?.SkillOrder ?? []

// Traduz nomes de sets, armas e personagens em inglês que aparecem nos textos dos guias.
const translations = [...setInfo.values(), ...weaponInfo.values(), ...characters.values()]
  .filter((v) => v.nameEn && v.name && v.nameEn !== v.name && !v.nameEn.includes('('))
  .sort((a, b) => b.nameEn.length - a.nameEn.length)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const translationRe = new RegExp(`\\b(${translations.map((t) => escape(t.nameEn)).join('|')})\\b`, 'g')
const translationMap = new Map(translations.map((t) => [t.nameEn, t.name]))

export const localizeText = (text: string) =>
  text.replace(translationRe, (m) => translationMap.get(m) ?? m).replace(/\b([nd]?)a ampulheta\b/gi, '$1o Relógio')
    .replace(/\bampulheta\b/gi, 'Relógio')
