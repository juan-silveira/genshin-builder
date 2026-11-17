// Importa os dados do app antigo (arquivos .data/*.json, um usuário só) para uma conta nova no banco.
// Uso: tsx scripts/import-local.ts <pasta com config.json/account.json/wishes.json> <usuário> <senha>
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createUser } from '../server/src/auth'
import { putDoc } from '../server/src/db'
import { saveCache, saveConfig } from '../server/src/storage'

const [dir, username, password] = process.argv.slice(2)
if (!dir || !username || !password) {
  console.error('uso: import-local <pasta> <usuário> <senha>')
  process.exit(1)
}
const read = (f: string) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : undefined)

const id = await createUser(username, password)
const config = read('config.json')
if (config) saveConfig(id, config)
const cache = read('account.json')
if (cache) saveCache(id, cache)
const wishes = read('wishes.json')
if (wishes) putDoc(id, 'wishes', wishes)
console.log(`ok: usuário ${username} criado com ${config ? 'config' : ''} ${cache ? `+ ${cache.account.characters.length} personagens` : ''} ${wishes ? '+ desejos' : ''}`)
