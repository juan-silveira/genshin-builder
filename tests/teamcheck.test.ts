import { describe, expect, it } from 'vitest'
import type { Account, Character } from '../shared/types'
import { analyzeAccount } from '../server/src/analysis'
import { characterByEn, weaponByEn } from '../server/src/gamedata'
import { checkTeam } from '../server/src/teamcheck'

const id = (n: string) => characterByEn(n)!.id
const ready = (name: string, weapon: string): Character => ({
  id: id(name), level: 90, constellation: 0, stats: {},
  weapon: { id: weaponByEn(weapon)!.id, level: 90, refinement: 1, rarity: 4 },
  artifacts: (['flower', 'plume', 'sands', 'goblet', 'circlet'] as const).map((slot) => ({
    setId: '15020', slot, rarity: 5, level: 20, mainStat: 'atk_', mainValue: 0, substats: [],
  })),
})
const view = (chars: Character[]) => {
  const acc: Account = { uid: '600000000', nickname: 't', source: 'enka', fetchedAt: '', characters: chars, warnings: [] }
  return analyzeAccount(acc, new Map(), [])
}

describe('checkTeam', () => {
  it('aponta falta de cura/escudo e sugere quem ela tem pronto', () => {
    const chars = [ready('Diluc', "Wolf's Gravestone"), ready('Keqing', 'The Black Sword'), ready('Xiangling', '"The Catch"'),
      ready('Fischl', 'The Stringless'), ready('Bennett', 'The Black Sword')]
    const r = checkTeam(view(chars), chars.slice(0, 4).map((c) => c.id), [])
    const text = r.issues.map((i) => i.text).join('\n')
    expect(r.verdict).toBe('nao')
    expect(text).toMatch(/Sem cura nem escudo.*inclua Bennett/)
  })

  it('reconhece reações e ressonância', () => {
    const chars = [ready('Xiangling', '"The Catch"'), ready('Bennett', 'The Black Sword'), ready('Xingqiu', 'The Black Sword'), ready('Sucrose', 'The Widsith')]
    const r = checkTeam(view(chars), chars.map((c) => c.id), [])
    expect(r.good.join('\n')).toMatch(/Vaporizar/)
    expect(r.good.join('\n')).toMatch(/Ressonância Pyro/)
  })
})
