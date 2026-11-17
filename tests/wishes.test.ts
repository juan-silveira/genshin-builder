import { describe, expect, it } from 'vitest'
import {
  UNDO_LIMIT, WishError, applyAction, emptyWishes, normalizeWishes, parseAction, pullsFromBudget, worstCaseFeatured,
  type WishAction, type WishesState,
} from '../shared/wishes'

const now = new Date(2026, 10, 17)
const run = (actions: WishAction[], s: WishesState = emptyWishes()) => actions.reduce((st, a) => applyAction(st, a, now), s)

describe('contador de desejos', () => {
  it('soma tiros no pity de 5★, de 4★ e no total', () => {
    const b = run([{ type: 'pull', banner: 'character', count: 10 }, { type: 'pull', banner: 'character', count: 1 }]).banners.character
    expect(b).toMatchObject({ pity5: 11, pity4: 11, total: 11 })
  })

  it('saiu 4★ zera só o contador de 4★', () => {
    const b = run([{ type: 'pull', banner: 'standard', count: 7 }, { type: 'four', banner: 'standard' }]).banners.standard
    expect(b).toMatchObject({ pity5: 7, pity4: 0, total: 7 })
  })

  it('perder o 50/50 deixa o próximo garantido e conta a derrota', () => {
    let s = run([{ type: 'pull', banner: 'character', count: 10 }, { type: 'five', banner: 'character', name: 'Qiqi', featured: false, after: 3 }])
    let b = s.banners.character
    expect(b).toMatchObject({ pity5: 3, guaranteed: true, lossStreak: 1 })
    expect(b.history).toEqual([{ date: '2026-11-17', name: 'Qiqi', pity: 7, result: 'lost' }])

    // com garantia, "featured" é ignorado e o resultado é "garantido"
    s = run([{ type: 'pull', banner: 'character', count: 1 }, { type: 'five', banner: 'character', name: 'Furina', featured: false }], s)
    b = s.banners.character
    expect(b).toMatchObject({ pity5: 0, guaranteed: false, lossStreak: 1 })
    expect(b.history[1]).toMatchObject({ name: 'Furina', pity: 4, result: 'guaranteed' })
  })

  it('ganhar o 50/50 mantém sem garantia e zera as derrotas seguidas', () => {
    const s = run([{ type: 'set', banner: 'character', pity5: 75, lossStreak: 2 }, { type: 'pull', banner: 'character', count: 1 },
      { type: 'five', banner: 'character', name: 'Nahida', featured: true }])
    expect(s.banners.character).toMatchObject({ pity5: 0, guaranteed: false, lossStreak: 0 })
    expect(s.banners.character.history[0]).toMatchObject({ pity: 76, result: 'won' })
  })

  it('exige dizer se ganhou o 50/50 e ter tiros marcados', () => {
    expect(() => run([{ type: 'pull', banner: 'character', count: 1 }, { type: 'five', banner: 'character', name: 'X' }])).toThrow(WishError)
    expect(() => run([{ type: 'five', banner: 'standard', name: 'Diluc' }])).toThrow(WishError)
  })

  it('Crônica tem garantia mas não conta Captura Radiante', () => {
    const b = run([{ type: 'pull', banner: 'chronicled', count: 1 }, { type: 'five', banner: 'chronicled', name: 'Jean', featured: false }]).banners.chronicled
    expect(b).toMatchObject({ guaranteed: true, lossStreak: 0 })
  })

  it('arma: Ponto de Destino depois de errar, e zera ao acertar', () => {
    let s = run([{ type: 'pull', banner: 'weapon', count: 10 }, { type: 'five', banner: 'weapon', name: 'Wolf-Fang', featured: false }])
    expect(s.banners.weapon).toMatchObject({ fatePoint: 1, pity5: 0 })
    expect(s.banners.weapon.history[0].result).toBe('lost')
    s = run([{ type: 'pull', banner: 'weapon', count: 1 }, { type: 'five', banner: 'weapon', name: 'Splendor of Tranquil Waters' }], s)
    expect(s.banners.weapon.fatePoint).toBe(0)
    expect(s.banners.weapon.history[1].result).toBe('guaranteed')
    s = run([{ type: 'pull', banner: 'weapon', count: 1 }, { type: 'five', banner: 'weapon', name: 'Splendor', featured: true }], s)
    expect(s.banners.weapon).toMatchObject({ fatePoint: 0 })
    expect(s.banners.weapon.history[2].result).toBe('won')
  })

  it('desfazer volta ao estado anterior, por banner', () => {
    const base = run([{ type: 'pull', banner: 'character', count: 10 }, { type: 'pull', banner: 'weapon', count: 1 }])
    const after5 = run([{ type: 'five', banner: 'character', name: 'Qiqi', featured: false }], base)
    const undone = run([{ type: 'undo', banner: 'character' }], after5)
    expect(undone.banners.character).toEqual(base.banners.character)
    expect(undone.banners.weapon).toEqual(base.banners.weapon)
    const empty = run([{ type: 'undo', banner: 'character' }], undone)
    expect(empty.banners.character.pity5).toBe(0)
    expect(() => run([{ type: 'undo', banner: 'character' }], empty)).toThrow('Nada para desfazer')
  })

  it(`guarda só as últimas ${UNDO_LIMIT} ações`, () => {
    const s = run(Array.from({ length: 25 }, () => ({ type: 'pull', banner: 'standard', count: 1 }) as WishAction))
    expect(s.banners.standard.undo).toHaveLength(UNDO_LIMIT)
    expect(s.banners.standard.undo[0].before.pity5).toBe(5)
  })

  it('não altera o estado original', () => {
    const s = emptyWishes()
    run([{ type: 'pull', banner: 'character', count: 10 }], s)
    expect(s.banners.character.pity5).toBe(0)
  })
})

describe('validação e números', () => {
  it('rejeita entradas inválidas', () => {
    expect(() => parseAction({ type: 'pull', banner: 'character', count: 11 })).toThrow(WishError)
    expect(() => parseAction({ type: 'pull', banner: 'x', count: 1 })).toThrow(WishError)
    expect(() => parseAction({ type: 'set', banner: 'weapon', pity5: 80 })).toThrow(WishError)
    expect(() => parseAction({ type: 'set', banner: 'weapon', fatePoint: 2 })).toThrow(WishError)
    expect(() => parseAction({ type: 'five', banner: 'character', name: '  ' })).toThrow(WishError)
    expect(() => parseAction({ type: 'hack', banner: 'character' })).toThrow(WishError)
    expect(parseAction({ type: 'set', banner: 'character', pity5: 40, guaranteed: true, extra: 1 }))
      .toEqual({ type: 'set', banner: 'character', pity5: 40, guaranteed: true })
  })

  it('completa arquivos antigos', () => {
    const s = normalizeWishes({ banners: { character: { pity5: 30 } } })
    expect(s.banners.character).toMatchObject({ pity5: 30, pity4: 0, history: [], undo: [] })
    expect(s.banners.weapon.pity5).toBe(0)
    expect(normalizeWishes(undefined).banners.standard.total).toBe(0)
  })

  it('calcula tiros e pior caso', () => {
    expect(pullsFromBudget(1000, 3)).toBe(9)
    const s = run([{ type: 'set', banner: 'character', pity5: 50 }])
    expect(worstCaseFeatured(s.banners.character, 'character')).toBe(130)
    expect(worstCaseFeatured({ ...s.banners.character, guaranteed: true }, 'character')).toBe(40)
    expect(worstCaseFeatured(s.banners.weapon, 'weapon')).toBe(160)
    expect(worstCaseFeatured(s.banners.standard, 'standard')).toBeUndefined()
  })
})
