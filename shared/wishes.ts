// Contador manual de desejos (gacha). No PS5 não há como importar o histórico,
// então o estado é montado ação por ação. Tudo aqui é puro para poder ser testado.

export type BannerId = 'character' | 'weapon' | 'standard' | 'chronicled'
/** won = ganhou o 50/50 (ou acertou a arma escolhida sem Ponto de Destino); lost = perdeu; guaranteed = veio pela garantia. */
export type FiveStarResult = 'won' | 'lost' | 'guaranteed'

export interface FiveStar {
  date: string // AAAA-MM-DD
  name: string
  pity: number
  result?: FiveStarResult
}

export interface BannerCounters {
  pity5: number // tiros desde o último 5★
  pity4: number // tiros desde o último 4★
  total: number
  guaranteed: boolean // personagem/crônica: perdeu o último 50/50
  lossStreak: number // personagem: derrotas seguidas no 50/50 (Captura Radiante)
  fatePoint: number // arma: Ponto de Destino (0 ou 1)
  history: FiveStar[] // mais antigo primeiro
}

export interface UndoEntry { label: string; before: BannerCounters }
export interface BannerState extends BannerCounters { undo: UndoEntry[] }
export interface WishesState { banners: Record<BannerId, BannerState>; updatedAt?: string }

export type WishAction =
  | { type: 'pull'; banner: BannerId; count: number }
  | { type: 'four'; banner: BannerId }
  | { type: 'five'; banner: BannerId; name: string; featured?: boolean; after?: number; date?: string }
  | { type: 'set'; banner: BannerId; pity5?: number; pity4?: number; total?: number; guaranteed?: boolean; lossStreak?: number; fatePoint?: number }
  | { type: 'undo'; banner: BannerId }

export interface BannerInfo {
  label: string
  hard: number
  soft: number
  /** como o 5★ é decidido: 50/50 com garantia, Caminho Epitomizado ou nada (padrão) */
  mode: 'fifty' | 'fate' | 'none'
}

export const BANNER_IDS: BannerId[] = ['character', 'weapon', 'standard', 'chronicled']
export const BANNERS: Record<BannerId, BannerInfo> = {
  character: { label: 'Personagem (evento)', hard: 90, soft: 74, mode: 'fifty' },
  weapon: { label: 'Arma', hard: 80, soft: 63, mode: 'fate' },
  standard: { label: 'Padrão (Mochileiro)', hard: 90, soft: 74, mode: 'none' },
  chronicled: { label: 'Crônica', hard: 90, soft: 74, mode: 'fifty' },
}
export const PITY4 = 10
export const PRIMOS_PER_PULL = 160
export const UNDO_LIMIT = 20

export class WishError extends Error {}

const emptyBanner = (): BannerState => ({ pity5: 0, pity4: 0, total: 0, guaranteed: false, lossStreak: 0, fatePoint: 0, history: [], undo: [] })

export const emptyWishes = (): WishesState => ({
  banners: { character: emptyBanner(), weapon: emptyBanner(), standard: emptyBanner(), chronicled: emptyBanner() },
})

/** Completa campos faltando (arquivo antigo ou editado à mão). */
export function normalizeWishes(raw: unknown): WishesState {
  const out = emptyWishes()
  const banners = (raw as WishesState | undefined)?.banners
  if (banners && typeof banners === 'object') {
    for (const id of BANNER_IDS) if (banners[id]) out.banners[id] = { ...emptyBanner(), ...banners[id] }
  }
  out.updatedAt = (raw as WishesState | undefined)?.updatedAt
  return out
}

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max

/** Valida o corpo do POST e devolve uma ação limpa (ou lança WishError com a mensagem para a tela). */
export function parseAction(body: unknown): WishAction {
  const b = (body ?? {}) as Record<string, unknown>
  const banner = b.banner as BannerId
  if (!BANNER_IDS.includes(banner)) throw new WishError('Banner inválido.')
  switch (b.type) {
    case 'pull':
      if (!isInt(b.count, 1, 10)) throw new WishError('Quantidade de tiros deve ser de 1 a 10.')
      return { type: 'pull', banner, count: b.count }
    case 'four':
      return { type: 'four', banner }
    case 'undo':
      return { type: 'undo', banner }
    case 'five': {
      const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : ''
      if (!name) throw new WishError('Informe o nome do 5★.')
      if (b.featured !== undefined && typeof b.featured !== 'boolean') throw new WishError('Campo "featured" inválido.')
      if (b.after !== undefined && !isInt(b.after, 0, 9)) throw new WishError('Tiros depois do 5★ deve ser de 0 a 9.')
      if (b.date !== undefined && (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date))) throw new WishError('Data inválida.')
      return { type: 'five', banner, name, featured: b.featured as boolean | undefined, after: b.after as number | undefined, date: b.date as string | undefined }
    }
    case 'set': {
      const hard = BANNERS[banner].hard
      const out: WishAction = { type: 'set', banner }
      if (b.pity5 !== undefined) { if (!isInt(b.pity5, 0, hard - 1)) throw new WishError(`Tiros desde o último 5★ deve ser de 0 a ${hard - 1}.`); out.pity5 = b.pity5 }
      if (b.pity4 !== undefined) { if (!isInt(b.pity4, 0, PITY4 - 1)) throw new WishError(`Tiros desde o último 4★ deve ser de 0 a ${PITY4 - 1}.`); out.pity4 = b.pity4 }
      if (b.total !== undefined) { if (!isInt(b.total, 0, 1_000_000)) throw new WishError('Total de tiros inválido.'); out.total = b.total }
      if (b.guaranteed !== undefined) { if (typeof b.guaranteed !== 'boolean') throw new WishError('Garantia inválida.'); out.guaranteed = b.guaranteed }
      if (b.lossStreak !== undefined) { if (!isInt(b.lossStreak, 0, 10)) throw new WishError('Derrotas seguidas deve ser de 0 a 10.'); out.lossStreak = b.lossStreak }
      if (b.fatePoint !== undefined) { if (!isInt(b.fatePoint, 0, 1)) throw new WishError('Ponto de Destino deve ser 0 ou 1.'); out.fatePoint = b.fatePoint }
      return out
    }
    default:
      throw new WishError('Ação inválida.')
  }
}

const today = (now: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

const snapshot = ({ undo: _undo, ...c }: BannerState): BannerCounters => ({ ...c, history: [...c.history] })

/** Aplica uma ação e devolve um novo estado (não altera o original). */
export function applyAction(state: WishesState, action: WishAction, now = new Date()): WishesState {
  const cur = state.banners[action.banner]
  const info = BANNERS[action.banner]
  let next: BannerState
  let label: string

  switch (action.type) {
    case 'undo': {
      const last = cur.undo.at(-1)
      if (!last) throw new WishError('Nada para desfazer neste banner.')
      next = { ...last.before, undo: cur.undo.slice(0, -1) }
      return { ...state, banners: { ...state.banners, [action.banner]: next }, updatedAt: now.toISOString() }
    }
    case 'pull':
      label = action.count === 1 ? '+1 tiro' : `+${action.count} tiros`
      next = { ...cur, pity5: cur.pity5 + action.count, pity4: cur.pity4 + action.count, total: cur.total + action.count }
      break
    case 'four':
      label = 'Saiu 4★'
      next = { ...cur, pity4: 0 }
      break
    case 'five': {
      const after = action.after ?? 0
      if (after > cur.pity5 - 1) throw new WishError('Registre os tiros antes de marcar o 5★.')
      const pity = cur.pity5 - after
      let result: FiveStarResult | undefined
      next = { ...cur }
      if (info.mode === 'fifty') {
        if (cur.guaranteed) {
          result = 'guaranteed'
          next.guaranteed = false
        } else if (action.featured === false) {
          result = 'lost'
          next.guaranteed = true
          if (action.banner === 'character') next.lossStreak = cur.lossStreak + 1
        } else if (action.featured === true) {
          result = 'won'
          if (action.banner === 'character') next.lossStreak = 0
        } else {
          throw new WishError('Diga se o 5★ foi o do banner.')
        }
      } else if (info.mode === 'fate') {
        if (cur.fatePoint >= 1) {
          result = 'guaranteed'
          next.fatePoint = 0
        } else if (action.featured === false) {
          result = 'lost'
          next.fatePoint = 1
        } else if (action.featured === true) {
          result = 'won'
        } else {
          throw new WishError('Diga se a arma foi a escolhida no Caminho Epitomizado.')
        }
      }
      label = `Saiu 5★: ${action.name}`
      next.pity5 = after
      next.history = [...cur.history, { date: action.date ?? today(now), name: action.name, pity, ...(result ? { result } : {}) }]
      break
    }
    case 'set': {
      label = 'Correção manual'
      const { type: _t, banner: _b, ...fields } = action
      next = { ...cur, ...fields }
      break
    }
  }

  next.undo = [...cur.undo, { label, before: snapshot(cur) }].slice(-UNDO_LIMIT)
  return { ...state, banners: { ...state.banners, [action.banner]: next }, updatedAt: now.toISOString() }
}

// ---- números para a tela ----

export const pullsLeft = (b: BannerCounters, id: BannerId) => Math.max(0, BANNERS[id].hard - b.pity5)

/** Pior caso para garantir o 5★ em destaque (personagem do banner / arma escolhida). */
export function worstCaseFeatured(b: BannerCounters, id: BannerId): number | undefined {
  const info = BANNERS[id]
  if (info.mode === 'none') return undefined
  const secured = info.mode === 'fifty' ? b.guaranteed : b.fatePoint >= 1
  return pullsLeft(b, id) + (secured ? 0 : info.hard)
}

export const pullsFromBudget = (primos: number, fates: number) =>
  Math.max(0, Math.floor(Math.max(0, primos) / PRIMOS_PER_PULL)) + Math.max(0, Math.floor(fates))
