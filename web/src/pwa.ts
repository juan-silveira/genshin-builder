// Registro do app instalado (service worker): checa versão nova ao abrir e a cada 30 min, e recarrega sozinho.
import { registerSW } from 'virtual:pwa-register'

declare const __APP_VERSION__: string
export const APP_VERSION = __APP_VERSION__

export function setupPwa() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      setInterval(() => reg.update().catch(() => {}), 30 * 60_000)
      // ao voltar para o app, também checa
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    },
  })
  // quando um service worker novo assume, recarrega para usar a versão nova
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

/** versão publicada no servidor (sem cache) */
export async function serverVersion(): Promise<string | null> {
  try {
    const r = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' })
    return (await r.json()).version ?? null
  } catch {
    return null
  }
}

/** limpa tudo que o app guardou no aparelho (service worker e caches) e recarrega da internet */
export async function hardRefresh() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch { /* sem service worker */ }
  try {
    const keys = (await caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch { /* sem cache storage */ }
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}
