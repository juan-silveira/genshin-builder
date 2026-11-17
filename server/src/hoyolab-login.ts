// Login na HoYoLAB pelo navegador: abre o Chrome normal no site oficial, a pessoa entra como sempre,
// e o app só lê os cookies depois. A senha é digitada no hoyolab.com, nunca passa pelo app.
// O Chrome é aberto SEM as flags de automação (só com a porta de depuração), e usa um perfil
// próprio em .data/hoyolab-browser — assim o login fica salvo e renovar os cookies depois é um clique.
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { HoyolabCookies } from './hoyolab'
import { STATE } from './paths'

const PROFILE = join(STATE, 'hoyolab-browser')
const PORT = 9333
const TIMEOUT_MS = 5 * 60_000

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((p): p is string => !!p)

let running: Promise<HoyolabCookies> | undefined

export function loginWithBrowser(): Promise<HoyolabCookies> {
  running ??= run().finally(() => { running = undefined })
  return running
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function run(): Promise<HoyolabCookies> {
  // carregado só aqui: no servidor (Docker) o playwright-core nem é instalado
  const { chromium } = await import('playwright-core')
  const exe = CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!exe) throw new Error('Chrome não encontrado neste computador. Instale o Google Chrome ou defina CHROME_PATH.')

  const proc: ChildProcess = spawn(exe, [
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    'https://www.hoyolab.com/home',
  ], { stdio: 'ignore' })
  let exited = false
  proc.on('exit', () => { exited = true })

  try {
    let browser
    for (let i = 0; i < 40 && !browser; i++) {
      if (exited) throw new Error('A janela do Chrome fechou antes de abrir a HoYoLAB.')
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => undefined)
      if (!browser) await sleep(250)
    }
    if (!browser) throw new Error('Não consegui me conectar à janela do Chrome.')

    const deadline = Date.now() + TIMEOUT_MS
    while (Date.now() < deadline) {
      if (exited) throw new Error('A janela foi fechada antes de terminar o login.')
      const context = browser.contexts()[0]
      const cookies = context ? await context.cookies('https://www.hoyolab.com').catch(() => []) : []
      const get = (name: string) => cookies.find((c) => c.name === name)?.value
      const ltuid = get('ltuid_v2')
      const ltoken = get('ltoken_v2')
      if (ltuid && ltoken) {
        await browser.close().catch(() => {})
        return { ltuid, ltoken, ltmid: get('ltmid_v2') }
      }
      await sleep(1500)
    }
    throw new Error('Tempo esgotado (5 min) esperando o login na HoYoLAB.')
  } finally {
    if (!exited) proc.kill()
  }
}
