import { describe, expect, it } from 'vitest'
import type { Guide, TeamGuide } from '../shared/guide-types'
import type { Account, Artifact, Character } from '../shared/types'
import { analyzeAccount, bestPair, scoreArtifact } from '../server/src/analysis'
import { characterByEn, localizeText, setByEn, weaponByEn } from '../server/src/gamedata'

const id = (n: string) => characterByEn(n)!.id
const emblem = setByEn('Emblem of Severed Fate')!.id

const art = (slot: Artifact['slot'], mainStat: Artifact['mainStat'], subs: Artifact['substats'], level = 20): Artifact => ({
  setId: emblem, slot, rarity: 5, level, mainStat, mainValue: 0, substats: subs,
})

const raidenGuide: Guide = {
  character: 'Raiden Shogun',
  roles: [{
    name: 'DPS principal',
    weapons: [{ name: 'Engulfing Lightning' }, { name: '"The Catch"', note: 'F2P' }],
    artifactSets: [{ sets: [{ name: 'Emblem of Severed Fate', pieces: 4 }] }],
    mainStats: { sands: ['enerRech_', 'atk_'], goblet: ['electro_dmg_', 'atk_'], circlet: ['critRate_', 'critDMG_'] },
    substats: { critRate_: 1, critDMG_: 1, enerRech_: 0.75, atk_: 0.75 },
    erMin: 250,
    talentPriority: ['burst', 'skill', 'auto'],
  }],
}

const raiden = (over: Partial<Character> = {}): Character => ({
  id: id('Raiden Shogun'), level: 90, constellation: 0,
  talents: { auto: 6, skill: 9, burst: 9 },
  weapon: { id: weaponByEn('"The Catch"')!.id, level: 90, refinement: 5, rarity: 4 },
  artifacts: [
    art('flower', 'hp', [{ key: 'critRate_', value: 7.8 }, { key: 'critDMG_', value: 15.5 }, { key: 'def', value: 23 }]),
    art('plume', 'atk', [{ key: 'critRate_', value: 3.9 }]),
    art('sands', 'atk_', [{ key: 'enerRech_', value: 6.5 }]),
    art('goblet', 'electro_dmg_', [{ key: 'critDMG_', value: 7.8 }]),
    art('circlet', 'hp_', [{ key: 'critRate_', value: 3.9 }]),
  ],
  stats: { enerRech_: 230, critRate_: 40, critDMG_: 100 },
  ...over,
})

describe('scoreArtifact', () => {
  it('conta rolagens úteis ponderadas pelo guia', () => {
    const a = scoreArtifact(raiden().artifacts[0], raidenGuide.roles[0].substats, raidenGuide.roles[0])
    // 2 rolagens de Taxa + 2 de Dano Crít; DEF plana vale 0
    expect(a.score).toBeCloseTo(4, 0)
    expect(a.critValue).toBeCloseTo(31.1, 1)
    expect(a.mainStatOk).toBeNull()
  })

  it('marca atributo principal errado e derruba a nota', () => {
    const circlet = raiden().artifacts[4]
    const a = scoreArtifact(circlet, raidenGuide.roles[0].substats, raidenGuide.roles[0])
    expect(a.mainStatOk).toBe(false)
    expect(['C', 'D']).toContain(a.grade)
  })
})

describe('analyzeAccount', () => {
  const account = (chars: Character[]): Account => ({
    uid: '600000000', nickname: 'teste', source: 'enka', fetchedAt: '', characters: chars, warnings: [],
  })
  const guides = new Map([[id('Raiden Shogun'), raidenGuide]])

  it('gera dicas de tiara, recarga e talentos', () => {
    const v = analyzeAccount(account([raiden()]), guides, [])
    const texts = v.characters[0].roles[0].advice.map((t) => t.text).join('\n')
    expect(texts).toMatch(/Tiara está com Vida%/)
    expect(texts).toMatch(/Recarga de Energia em 230%/)
    expect(v.characters[0].roles[0].advice[0].level).toBe('alta')
  })

  it('reconhece set completo e arma da lista', () => {
    const v = analyzeAccount(account([raiden()]), guides, [])
    const role = v.characters[0].roles[0]
    expect(role.artifactSets[0].matched).toBe(true)
    expect(role.weapons.find((w) => w.id === weaponByEn('"The Catch"')!.id)).toBeTruthy()
  })

  it('monta equipes com substitutos e ignora as que faltam 2+', () => {
    const teams: TeamGuide[] = [
      { name: 'Nacional', carry: 'Raiden Shogun', rotation: ['x'], slots: [['Raiden Shogun'], ['Xiangling'], ['Xingqiu', 'Yelan'], ['Bennett']] },
      { name: 'Impossível', carry: 'Raiden Shogun', rotation: ['x'], slots: [['Raiden Shogun'], ['Nahida'], ['Furina'], ['Kaedehara Kazuha']] },
    ]
    const chars = ['Xiangling', 'Yelan', 'Bennett'].map((n) => ({ id: id(n), level: 90, constellation: 0, artifacts: [], stats: {} }))
    const v = analyzeAccount(account([raiden(), ...chars]), guides, teams)
    expect(v.teams.map((t) => t.name)).toEqual(['Nacional'])
    const slot3 = v.teams[0].members[2]
    expect(slot3.name).toBe('Yelan')
    expect(slot3.choice).toBe(1)
  })
})

describe('bestPair', () => {
  it('escolhe duas equipes sem personagem repetido', () => {
    const m = (ids: string[]) => ids.map((i) => ({ id: i, name: i, owned: true, choice: 0, alternatives: [], rarity: 5 }))
    const t = (name: string, ids: string[], score: number) =>
      ({ name, tags: [], members: m(ids), missing: 0, carryId: ids[0], rotation: [], score })
    const pair = bestPair([t('A', ['1', '2', '3', '4'], 90), t('B', ['1', '5', '6', '7'], 85), t('C', ['5', '6', '7', '8'], 60)])
    expect(pair).toEqual([0, 2])
  })
})

describe('localizeText', () => {
  it('traduz nomes de sets e armas para PT', () => {
    expect(localizeText('Use Blizzard Strayer na ampulheta')).toBe('Use Herói Invernal no Relógio')
  })
})

describe('upgradePlan', () => {
  const account = (chars: Character[]): Account => ({
    uid: '600000000', nickname: 'teste', source: 'enka', fetchedAt: '', characters: chars, warnings: [],
  })
  const guides = new Map([[id('Raiden Shogun'), raidenGuide]])

  it('corrigir o principal errado vem primeiro e a nota acumulada só sobe', () => {
    const v = analyzeAccount(account([raiden()]), guides, [])
    const plan = v.characters[0].roles[0].upgradePlan
    expect(plan[0].text).toMatch(/Trocar Tiara: principal Vida%/)
    for (let i = 1; i < plan.length; i++) expect(plan[i].resultPct).toBeGreaterThanOrEqual(plan[i - 1].resultPct)
  })

  it('sem artefatos vira um passo só', () => {
    const v = analyzeAccount(account([raiden({ artifacts: [] })]), guides, [])
    const plan = v.characters[0].roles[0].upgradePlan
    expect(plan).toHaveLength(1)
    expect(plan[0].text).toMatch(/^Equipar artefatos: Flor; Pena; .* e Tiara com/)
  })

  it('sugere upar peça 5★ abaixo de +20', () => {
    const low = raiden()
    low.artifacts[3] = { ...low.artifacts[3], level: 8 }
    const v = analyzeAccount(account([low]), guides, [])
    expect(v.characters[0].roles[0].upgradePlan.some((s) => s.text === 'Subir Cálice de +8 para +20')).toBe(true)
  })
})
