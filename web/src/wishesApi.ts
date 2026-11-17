import type { WishAction, WishesState } from '../../shared/wishes'
import { request } from './api'

export const wishesApi = {
  state: () => request<WishesState>('GET', 'wishes'),
  act: (action: WishAction) =>
    request<WishesState>('POST', 'wishes', action).catch((e: Error) => {
      throw new Error(`Não foi salvo: ${e.message} Depois marque de novo.`)
    }),
}
