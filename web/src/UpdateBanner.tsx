import { useEffect, useState } from 'react'
import { APP_VERSION, hardRefresh, serverVersion } from './pwa'

/** aparece quando a versão publicada é diferente da que está no aparelho */
export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null)
  useEffect(() => {
    const check = () => serverVersion().then(setLatest)
    check()
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(check, 10 * 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t) }
  }, [])
  if (!latest || latest === APP_VERSION) return null
  return (
    <div className="notice update-banner" role="status">
      <span>Há uma versão nova do app.</span>
      <button className="btn solid" onClick={() => hardRefresh()}>Atualizar agora</button>
    </div>
  )
}
