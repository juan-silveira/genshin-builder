// Caminhos do app. Em produção (bundle no Docker) APP_ROOT aponta para /app.
import { join } from 'node:path'

export const ROOT = process.env.APP_ROOT ?? join(import.meta.dirname, '../..')
export const DATA = join(ROOT, 'data')
export const DIST = join(ROOT, 'dist')
/** onde ficam o banco e o perfil do Chrome do login local */
export const STATE = process.env.STATE_DIR ?? join(ROOT, '.data')
