import { describe, expect, it } from 'vitest'
import { adaptControls } from '../shared/controls'

const ps = (t: string) => adaptControls(t, 'ps')

describe('adaptControls (PS5)', () => {
  it('troca E/Q pelos botões do controle', () => {
    expect(ps('Bennett: Supremo (Q) e Habilidade (E)')).toBe('Bennett: Supremo (△) e Habilidade (R2)')
    expect(ps('Zhongli: Habilidade (E) segurada para escudo')).toBe('Zhongli: Habilidade (segure R2) para escudo')
  })

  it('não mexe na conjunção "e"', () => {
    expect(ps('Xiangling e Bennett')).toBe('Xiangling e Bennett')
  })

  it('anota ataques só na primeira menção', () => {
    expect(ps('Ataques Normais, depois Ataques Normais')).toBe('Ataques Normais (○), depois Ataques Normais')
    expect(ps('Ataques Carregados até acabar')).toBe('Ataques Carregados (segure ○) até acabar')
    expect(ps('Xiao: Ataques Mergulhantes repetidos')).toBe('Xiao: Ataques Mergulhantes (✕ e ○ no ar) repetidos')
  })

  it('trata tiro mirado e cancelamento', () => {
    expect(ps('vem do Ataque Carregado mirado')).toBe('vem do Ataque Carregado mirado (L2 para mirar, segure ○)')
    expect(ps('cancele com pulo/dash')).toBe('cancele com pulo (✕) ou corrida (R1)')
  })

  it('no PC deixa o texto como está', () => {
    expect(adaptControls('Supremo (Q)', 'pc')).toBe('Supremo (Q)')
  })
})
