import { describe, expect, it } from 'vitest'
import { parseRewards, redeemUrl } from '../server/src/codes'

describe('parseRewards', () => {
  it('traduz e conta as recompensas', () => {
    expect(parseRewards("Primogem*60;Mora*30,000;Hero's Wit*3")).toEqual([
      { name: 'Gema Essencial', count: 60 },
      { name: 'Mora', count: 30000 },
      { name: 'EXP do Herói', count: 3 },
    ])
  })
  it('mantém o nome original quando não conhece o item', () => {
    expect(parseRewards('Item Desconhecido*2')).toEqual([{ name: 'Item Desconhecido', count: 2 }])
  })
  it('monta o link oficial de resgate', () => {
    expect(redeemUrl('ABC123')).toBe('https://genshin.hoyoverse.com/pt/gift?code=ABC123')
  })
})
