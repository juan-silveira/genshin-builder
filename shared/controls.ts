// Converte as referências de teclado dos guias ("(E)", "(Q)", "Ataque Carregado"…) para o controle escolhido.
// Os guias são escritos com as teclas do PC; a conversão acontece só na hora de exibir.
// Layout padrão do Genshin no PlayStation: ○ ataque · R2 Habilidade · △ Supremo · ✕ pular · R1 correr · L2 mirar.

export type ControlScheme = 'ps' | 'pc'

export const CONTROL_LABEL: Record<ControlScheme, string> = { ps: 'PS5', pc: 'Teclado e mouse' }

export const TALENT_BUTTON: Record<ControlScheme, Record<'auto' | 'skill' | 'burst', string>> = {
  ps: { auto: '○', skill: 'R2', burst: '△' },
  pc: { auto: 'clique', skill: 'E', burst: 'Q' },
}

export const CONTROL_LEGEND: Record<ControlScheme, string[]> = {
  ps: [
    '○ Ataque Normal (segure ○ para o Ataque Carregado)',
    'R2 Habilidade Elemental (segure R2 para a versão longa)',
    '△ Supremo',
    '✕ pular · R1 correr · L2 mirar',
    'Direcional: trocar de personagem',
  ],
  pc: [
    'Clique esquerdo: Ataque Normal (segure para o Ataque Carregado)',
    'E: Habilidade Elemental (segure E para a versão longa)',
    'Q: Supremo',
    'Espaço pular · Shift correr · R mirar',
    '1–4: trocar de personagem',
  ],
}

// "uma vez por texto" evita repetir o botão em toda menção do mesmo golpe
const once = (re: RegExp, suffix: string) => (text: string) => {
  let done = false
  return text.replace(re, (m) => {
    if (done) return m
    done = true
    return `${m} (${suffix})`
  })
}

const PS_RULES: ((t: string) => string)[] = [
  (t) => t.replace(/\(E\) segurad[ao]/g, '(segure R2)'),
  (t) => t.replace(/toque longo da Habilidade/g, 'Habilidade segurada (segure R2)'),
  (t) => t.replace(/\(E\)/g, '(R2)'),
  (t) => t.replace(/\(Q\)/g, '(△)'),
  (t) => t.replace(/Ataques? Carregados? mirados?/g, (m) => `${m} (L2 para mirar, segure ○)`),
  (t) => t.replace(/Ataques? Carregados? segurados?/g, (m) => `${m} (segure ○)`),
  once(/Ataques? Carregados?\b(?! (?:mirad|segurad))(?! \()/, 'segure ○'),
  once(/Ataques? Norma(?:l|is)\b(?! \()/, '○'),
  once(/Ataques? Mergulhantes?\b(?! \()/, '✕ e ○ no ar'),
  (t) => t.replace(/pulo\/dash/g, 'pulo (✕) ou corrida (R1)'),
]

export function adaptControls(text: string, scheme: ControlScheme): string {
  if (scheme === 'pc') return text
  return PS_RULES.reduce((t, rule) => rule(t), text)
}
