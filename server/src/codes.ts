// Códigos de resgate ativos, da lista comunitária hoyo-codes (github.com/seriaati/hoyo-codes),
// que verifica se cada código ainda funciona. O resgate é feito pela pessoa no site oficial.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RedeemCode } from '../../shared/view-types'
import { DATA } from './paths'

const SOURCE = 'https://hoyo-codes.seria.moe/codes?game=genshin'
const TTL = 60 * 60_000

const namesFile = join(DATA, 'gamedb/item-names.json')
const itemNames: Record<string, string> = existsSync(namesFile) ? JSON.parse(readFileSync(namesFile, 'utf8')) : {}

let cache: { at: number; codes: { code: string; rewards: string }[]; error?: string } | undefined

/** "Primogem*60;Mora*30,000" → [{ name: 'Gema Essencial', count: 60 }, …] */
export function parseRewards(raw: string) {
  return raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, count] = part.split('*')
    return { name: itemNames[name.trim().toLowerCase()] ?? name.trim(), count: Number(String(count ?? '1').replace(/[^\d]/g, '')) || 1 }
  })
}

export const redeemUrl = (code: string) => `https://genshin.hoyoverse.com/pt/gift?code=${encodeURIComponent(code)}`

export async function activeCodes(): Promise<{ codes: Omit<RedeemCode, 'redeemed'>[]; error?: string }> {
  if (!cache || Date.now() - cache.at > TTL) {
    try {
      const res = await fetch(SOURCE, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'genshin-builder (uso pessoal)' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const codes = (data.codes ?? [])
        .filter((c: any) => c.status === 'OK' && /^[A-Z0-9]{6,20}$/i.test(c.code))
        .map((c: any) => ({ code: String(c.code).toUpperCase(), rewards: String(c.rewards ?? '') }))
      cache = { at: Date.now(), codes }
    } catch (e: any) {
      // mantém a última lista boa se houver; tenta de novo em 10 minutos
      cache = { at: Date.now() - TTL + 10 * 60_000, codes: cache?.codes ?? [], error: 'Não consegui atualizar a lista de códigos agora.' }
    }
  }
  return {
    codes: cache.codes.map((c) => ({ code: c.code, rewards: parseRewards(c.rewards), url: redeemUrl(c.code) })),
    error: cache.error,
  }
}
