// Carrega os guias curados de data/guides e indexa pelo id do personagem.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Guide, TeamGuide } from '../../shared/guide-types'
import { characterByEn } from './gamedata'
import { DATA } from './paths'

const DIR = join(DATA, 'guides')

export function loadGuides() {
  const guides = new Map<string, Guide>()
  let teams: TeamGuide[] = []
  if (!existsSync(DIR)) return { guides, teams }

  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.json')) continue
    const data = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
    if (f === 'teams.json') teams = data
    else if (f.startsWith('characters')) {
      for (const g of data as Guide[]) {
        const ch = characterByEn(g.character)
        if (ch) guides.set(ch.id, g)
      }
    }
  }
  return { guides, teams }
}
