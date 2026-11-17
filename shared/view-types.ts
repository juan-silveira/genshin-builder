// O que o servidor devolve para a interface: conta + análise prontas para exibir.
import type { Element, SlotKey, StatKey, WeaponType } from './types'
import type { TalentKey } from './guide-types'

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface NamedRef { id: string; name: string; icon?: string; rarity?: number }

export interface ArtifactView {
  slot: SlotKey
  set: NamedRef
  rarity: number
  level: number
  mainStat: StatKey
  mainValue: number
  mainStatOk: boolean | null // null = sem guia ou slot fixo (flor/pena)
  substats: { key: StatKey; value: number; weight: number }[]
  /** "rolagens úteis" ponderadas pelo guia */
  score: number
  /** 0..100 */
  pct: number
  grade: Grade
  critValue: number
  icon?: string
}

export interface Tip {
  level: 'alta' | 'media' | 'baixa'
  text: string
}

export interface RoleView {
  name: string
  weapons: (NamedRef & { note?: string; owned: boolean })[]
  artifactSets: { sets: (NamedRef & { pieces: number; where?: string })[]; note?: string; matched: boolean }[]
  mainStats: Record<'sands' | 'goblet' | 'circlet', StatKey[]>
  substats: Partial<Record<StatKey, number>>
  erTarget?: string
  erMin?: number
  talentPriority: TalentKey[]
  tips?: string
  /** 0..100 — qualidade média dos artefatos para este papel */
  buildPct: number
  grade: Grade
  advice: Tip[]
  /** passos para subir a nota dos artefatos, do maior impacto para o menor */
  upgradePlan: UpgradeStep[]
}

export interface UpgradeStep {
  text: string
  /** o que procurar na peça nova (substatus mais úteis) */
  lookFor?: string
  /** pontos de nota que o passo deve somar */
  gain: number
  /** nota acumulada depois deste passo */
  resultPct: number
  resultGrade: Grade
}

export interface CharacterView {
  id: string
  name: string
  element?: Element
  weaponType?: WeaponType
  rarity: number
  icon?: string
  level: number
  constellation: number
  talents?: { auto: number; skill: number; burst: number }
  weapon?: NamedRef & { level: number; refinement: number }
  artifacts: ArtifactView[]
  setCounts: (NamedRef & { count: number })[]
  stats: Partial<Record<StatKey, number>>
  hasGuide: boolean
  guideConfidence?: 'alta' | 'media' | 'baixa'
  roles: RoleView[]
  /** índice do papel que melhor combina com a build atual */
  bestRole: number
  /** dicas genéricas quando não há guia */
  genericAdvice: Tip[]
  /** força de combate estimada 0..100: build + nível + talentos + arma + constelação */
  power: number
  /** o que puxa a força para baixo, em PT (ex.: "Nível 70") */
  powerNotes: string[]
  farm?: FarmPlan
  /** se dá para levar para o combate e o que falta */
  readiness: Readiness
}

export interface Readiness {
  /** sem nenhum problema que impeça jogar */
  ready: boolean
  /** impede o uso: nível < 70, menos de 3 artefatos, arma < 60 ou sem arma */
  blocking: string[]
  /** dá para usar, mas rende menos */
  warnings: string[]
}

export interface TeamMemberView {
  id: string
  name: string
  icon?: string
  element?: Element
  rarity: number
  owned: boolean
  /** posição da alternativa usada na lista do slot (0 = ideal) */
  choice: number
  /** outras opções desse slot (nomes) */
  alternatives: string[]
  /** quando é substituto: quem seria a escolha ideal e por que não foi usada */
  replaces?: { name: string; reason: 'nao-tem' | 'nao-pronto' | 'em-uso' }
  buildGrade?: Grade
  power?: number
  readiness?: Readiness
}

export interface TeamView {
  name: string
  tags: string[]
  members: TeamMemberView[]
  missing: number
  carryId: string
  rotation: string[]
  notes?: string
  score: number
  /** força média do time 0..100 */
  power: number
  /** pronta: todos prontos · preparar: tem todos, alguém precisa de preparo · falta: falta personagem */
  status: 'pronta' | 'preparar' | 'falta'
}

export interface AccountView {
  uid: string
  nickname: string
  level?: number
  worldLevel?: number
  source: 'enka' | 'hoyolab'
  fetchedAt: string
  warnings: string[]
  characters: CharacterView[]
  teams: TeamView[]
  /** duas equipes sem personagens repetidos para Abismo/Teatro */
  abyssPair?: [number, number]
  /** dia da semana no servidor do jogo (0 = domingo) */
  weekday: number
}

export interface AppState {
  username?: string
  /** login da HoYoLAB pela janela do Chrome (só no app rodando no PC) */
  browserLogin?: boolean
  uid?: string
  hasCookies: boolean
  view?: AccountView
}

export type MaterialCategory = 'dominio' | 'semanal' | 'chefe' | 'gema' | 'especialidade' | 'comum' | 'outro'

export interface FarmMaterial {
  id: number
  name: string
  rarity?: number
  count: number
  category: MaterialCategory
  /** domínio + entrada + região, ou a principal fonte */
  where: string
  extra?: string
  days?: string[]
  availableToday: boolean
  icon?: string
  /** página do mapa do app com os pontos deste material */
  mapUrl?: string
}

export interface FarmPlan {
  goals: string[]
  materials: FarmMaterial[]
  mora: number
}

export interface OptimizeMember {
  id: string
  name: string
  role: string
  before: { pct: number; grade: Grade; power: number; set?: string }
  after: { pct: number; grade: Grade; power: number; set?: string }
}

interface MoveBase {
  to: string
  toName: string
  from: string
  fromName: string
  /** a peça vem de outro membro do mesmo time (ou da outra equipe da dupla) */
  fromInTeam: boolean
}

export interface ArtifactMove extends MoveBase {
  slot: SlotKey
  slotName: string
  setName: string
  mainStat: string
  level: number
}

export interface WeaponMove extends MoveBase {
  weapon: string
  level: number
  refinement: number
}

export interface OptimizeResult {
  members: OptimizeMember[]
  artifactMoves: ArtifactMove[]
  weaponMoves: WeaponMove[]
}

export interface DailyNote {
  fetchedAt: string
  resin: number
  maxResin: number
  /** segundos até a resina encher */
  resinFullIn: number
  commissionsDone: number
  commissionsTotal: number
  commissionRewardClaimed: boolean
  weeklyBossDiscounts: number
  weeklyBossDiscountsMax: number
  realmCurrency: number
  realmCurrencyMax: number
  realmCurrencyFullIn: number
  expeditions: { icon?: string; done: boolean; remaining: number }[]
  expeditionsMax: number
  /** undefined = Transformador Paramétrico ainda não obtido */
  transformerReady?: boolean
}

export interface TodayFarmGroup {
  /** domínio + local */
  where: string
  materials: { name: string; icon?: string; count: number; mapUrl?: string; forChars: { id: string; name: string; icon?: string }[] }[]
}

export interface TodayView {
  weekday: number
  weekdayName: string
  note?: DailyNote
  noteError?: string
  /** domínios abertos hoje com materiais que os personagens prioritários precisam */
  farmToday: TodayFarmGroup[]
  /** materiais de chefes semanais que faltam (qualquer dia) */
  weekly: { name: string; icon?: string; count: number; where: string; mapUrl?: string; forChars: string[] }[]
  /** personagens considerados prioritários (estão nas melhores equipes) */
  focus: { id: string; name: string; icon?: string }[]
}

export interface RedeemCode {
  code: string
  rewards: { name: string; count: number }[]
  /** página oficial de resgate com o código preenchido */
  url: string
  redeemed: boolean
}

export interface CodesView {
  codes: RedeemCode[]
  error?: string
}

export interface MaterialMap {
  name: string
  icon?: string
  where?: string
  /** tamanho total da imagem do mapa em px [largura, altura] */
  size: [number, number]
  /** lado de cada pedaço da imagem (px) */
  slice: number
  /** URLs das imagens oficiais, [linha][coluna] */
  slices: string[][]
  /** pontos em px da imagem [x, y, id] */
  points: [number, number, number][]
  /** ids dos pontos que a pessoa marcou como coletados (ainda não renasceram) */
  collected: number[]
  /** horas até o item renascer (especialidades: 48 h; inimigos: 24 h) */
  respawnHours: number
  /** mapa interativo oficial da HoYoLAB filtrado neste item */
  officialUrl: string
}

export interface WeaponRow {
  key: string
  id: string
  name: string
  icon?: string
  rarity: number
  type?: WeaponType
  level: number
  refinement: number
  holder: { id: string; name: string; icon?: string }
  /** para quem a arma deveria ir (se diferente de quem está) */
  bestFor?: { id: string; name: string; icon?: string; reason: string }
  /** personagens dela cujo guia recomenda esta arma, com a posição na lista */
  recommendedFor: { id: string; name: string; rank: number }[]
  /** a arma está no lugar certo */
  ok: boolean
}

export interface WeaponsView { weapons: WeaponRow[]; moves: number }

export interface ArtifactRow {
  key: string
  slot: SlotKey
  slotName: string
  set: NamedRef
  rarity: number
  level: number
  mainStat: StatKey
  mainValue: number
  substats: { key: StatKey; value: number }[]
  holder: { id: string; name: string; icon?: string }
  /** nota para quem está usando (pelo guia dele) */
  grade?: Grade
  critValue: number
  mainStatOk: boolean | null
  /** quem deveria usar, se for outro personagem; from/to = nota do destino antes e depois de todas as trocas */
  bestFor?: { id: string; name: string; icon?: string; from: Grade; to: Grade; fromPct: number; toPct: number }
  ok: boolean
}

export interface SetSummary {
  id: string
  name: string
  icon?: string
  pieces: number
  /** quantos personagens usam bônus de 2 ou 4 peças desse set */
  where?: string
  /** personagens dela cujo guia recomenda o set */
  recommendedFor: string[]
}

export interface ArtifactsView { artifacts: ArtifactRow[]; moves: number; sets: SetSummary[] }

export interface TeamCheckIssue { level: 'alta' | 'media' | 'baixa'; text: string; charId?: string }

export interface TeamCheck {
  members: { id: string; name: string; icon?: string; element?: Element; rarity: number; role: 'principal' | 'sub' | 'suporte' | 'desconhecido'; ready: boolean; grade?: Grade }[]
  /** funciona · ressalvas · nao */
  verdict: 'funciona' | 'ressalvas' | 'nao'
  issues: TeamCheckIssue[]
  /** o que o time tem de bom */
  good: string[]
  /** equipe recomendada mais parecida e o que trocar para chegar nela */
  suggestion?: { team: string; swaps: { out: string; in: string; owned: boolean }[] }
}

export interface AbyssChamber {
  floor: number
  chamber: number
  stars: number
  /** times usados: [primeira metade, segunda metade] */
  halves: string[][]
}

export interface AbyssView {
  start: string
  end: string
  maxFloor: string
  stars: number
  battles: number
  chambers: AbyssChamber[]
}

export interface TeamCheckState {
  /** último time analisado (salvo) */
  saved?: string[]
  check?: TeamCheck
  abyss?: AbyssView
  abyssError?: string
}
