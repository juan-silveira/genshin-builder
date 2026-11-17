// Rotas do contador manual de desejos. Cada usuário tem o seu, no banco, igual em todos os aparelhos.
import type { Express } from 'express'
import { WishError, applyAction, normalizeWishes, parseAction } from '../../shared/wishes'
import { loadWishesRaw, saveWishes } from './storage'

export function registerWishRoutes(app: Express) {
  app.get('/api/wishes', (req, res) => {
    res.json(normalizeWishes(loadWishesRaw(req.userId!)))
  })

  app.post('/api/wishes', (req, res) => {
    try {
      const action = parseAction(req.body)
      const next = applyAction(normalizeWishes(loadWishesRaw(req.userId!)), action)
      saveWishes(req.userId!, next)
      res.json(next)
    } catch (e: any) {
      if (e instanceof WishError) return res.status(400).json({ error: e.message })
      res.status(500).json({ error: 'Falha ao salvar o contador.' })
    }
  })
}
