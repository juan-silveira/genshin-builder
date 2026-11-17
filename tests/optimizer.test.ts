import { describe, expect, it } from 'vitest'
import type { Guide } from '../shared/guide-types'
import type { Account, Artifact, Character } from '../shared/types'
import { gameWeekday } from '../server/src/farm'
import { characterByEn, setByEn, weaponByEn } from '../server/src/gamedata'
import { optimizeTeams } from '../server/src/optimizer'

const id = (n: string) => characterByEn(n)!.id
const emblem = setByEn('Emblem of Severed Fate')!.id
const gladiator = setByEn("Gladiator's Finale")!.id

const art = (setId: string, slot: Artifact['slot'], mainStat: Artifact['mainStat'], crit: number): Artifact => ({
  setId, slot, rarity: 5, level: 20, mainStat, mainValue: 0,
  substats: [{ key: 'critRate_', value: 3.9 * crit }, { key: 'critDMG_', value: 7.8 * crit }],
})
const fullSet = (setId: string, crit: number): Artifact[] => [
  art(setId, 'flower', 'hp', crit), art(setId, 'plume', 'atk', crit), art(setId, 'sands', 'enerRech_', crit),
  art(setId, 'goblet', 'electro_dmg_', crit), art(setId, 'circlet', 'critRate_', crit),
]
const char = (name: string, artifacts: Artifact[], weapon?: string): Character => ({
  id: id(name), level: 90, constellation: 0, artifacts, stats: {},
  weapon: weapon ? { id: weaponByEn(weapon)!.id, level: 90, refinement: 1, rarity: 5 } : undefined,
})

const raidenGuide: Guide = {
  character: 'Raiden Shogun',
  roles: [{
    name: 'DPS', weapons: [{ name: 'Engulfing Lightning' }, { name: '"The Catch"' }],
    artifactSets: [{ sets: [{ name: 'Emblem of Severed Fate', pieces: 4 }] }],
    mainStats: { sands: ['enerRech_'], goblet: ['electro_dmg_'], circlet: ['critRate_', 'critDMG_'] },
    substats: { critRate_: 1, critDMG_: 1 }, talentPriority: ['burst'],
  }],
}
const account = (chars: Character[]): Account => ({ uid: '612345678', nickname: 't', source: 'hoyolab', fetchedAt: '', characters: chars, warnings: [] })

describe('optimizeTeams', () => {
  it('pega peças melhores de quem está fora do time, mantendo o set do guia', () => {
    const raiden = char('Raiden Shogun', fullSet(emblem, 1), '"The Catch"')
    const keqing = char('Keqing', fullSet(emblem, 2)) // mesmas peças, com o dobro de crítico
    const r = optimizeTeams(account([raiden, keqing]), new Map([[raiden.id, raidenGuide]]), [raiden.id])
    expect(r.artifactMoves).toHaveLength(5)
    expect(r.artifactMoves.every((m) => m.from === keqing.id)).toBe(true)
    expect(r.members[0].after.set).toContain('4×')
  })

  it('não troca o set de 4 peças por peças avulsas só um pouco melhores', () => {
    const raiden = char('Raiden Shogun', fullSet(emblem, 1))
    const other = char('Keqing', fullSet(gladiator, 1.3))
    const r = optimizeTeams(account([raiden, other]), new Map([[raiden.id, raidenGuide]]), [raiden.id])
    expect(r.artifactMoves).toHaveLength(0)
  })

  it('troca para a arma do guia que está em outro personagem', () => {
    const raiden = char('Raiden Shogun', [], '"The Catch"')
    const other = char('Xiangling', [], 'Engulfing Lightning')
    const r = optimizeTeams(account([raiden, other]), new Map([[raiden.id, raidenGuide]]), [raiden.id])
    expect(r.weaponMoves.map((w) => w.from)).toEqual([other.id])
  })
})

describe('gameWeekday', () => {
  it('o dia do servidor América vira às 04:00 (UTC-5)', () => {
    // quarta 08:59 UTC = 03:59 no servidor → ainda terça
    expect(gameWeekday('612345678', Date.UTC(2026, 10, 18, 8, 59))).toBe(2)
    expect(gameWeekday('612345678', Date.UTC(2026, 10, 18, 9, 0))).toBe(3)
  })
})

describe('buildWeapons', () => {
  it('só pede arma de outro personagem quando ela está no próprio guia', async () => {
    const { buildWeapons } = await import('../server/src/weapons')
    const { analyzeAccount } = await import('../server/src/analysis')
    const raiden = char('Raiden Shogun', [], '"The Catch"')
    const xiang = char('Xiangling', [], 'Engulfing Lightning')
    const yelan = char('Xiangling', [], 'Staff of Homa')
    yelan.id = id('Shenhe') // lança 5★ fora do guia da Raiden
    const acc = account([raiden, xiang, yelan])
    const guides = new Map([[raiden.id, raidenGuide]])
    const w = buildWeapons(acc, analyzeAccount(acc, guides, []), guides)
    const moves = w.weapons.filter((x) => !x.ok)
    expect(moves.map((m) => [m.holder.id, m.bestFor?.id])).toEqual([[xiang.id, raiden.id]])
  })
})
