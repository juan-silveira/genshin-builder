// Baixa os arquivos de dados públicos do Enka.Network (nomes, ícones, sets) para data/enka.
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/gi'
const FILES = ['avatars', 'locs', 'weapons', 'relics']

await mkdir('data/enka', { recursive: true })
for (const f of FILES) {
  const res = await fetch(`${BASE}/${f}.json`)
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`)
  await writeFile(`data/enka/${f}.json`, await res.text())
  console.log(`ok ${f}.json`)
}
