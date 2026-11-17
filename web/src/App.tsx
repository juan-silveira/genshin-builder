import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ControlScheme } from '../../shared/controls'
import type { AppState } from '../../shared/view-types'
import { AUTH_EVENT, api, auth } from './api'
import { Login } from './pages/Login'
import { UpdateBanner } from './UpdateBanner'
import { Icon, ago } from './components'
import { CharacterDetail } from './pages/CharacterDetail'
import { Characters } from './pages/Characters'
import { Settings } from './pages/Settings'
import { Teams } from './pages/Teams'
import { MapPage } from './pages/MapPage'
import { Today } from './pages/Today'
import { Wishes } from './pages/Wishes'
import { Weapons } from './pages/Weapons'
import { Artifacts } from './pages/Artifacts'

interface Ctx {
  state: AppState | undefined
  setState: (s: AppState) => void
  refresh: () => Promise<void>
  refreshing: boolean
  error: string | undefined
  controls: ControlScheme
  setControls: (c: ControlScheme) => void
  logout: () => Promise<void>
}
const AppCtx = createContext<Ctx>(null!)
export const useApp = () => useContext(AppCtx)

export function App() {
  const [state, setState] = useState<AppState>()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string>()
  const [controls, setControlsState] = useState<ControlScheme>(() => {
    try {
      return localStorage.getItem('controle') === 'pc' ? 'pc' : 'ps'
    } catch {
      return 'ps'
    }
  })
  const setControls = (c: ControlScheme) => {
    setControlsState(c)
    try { localStorage.setItem('controle', c) } catch { /* sem armazenamento: vale só nesta sessão */ }
  }

  // sessão: undefined = verificando; null = precisa entrar
  const [user, setUser] = useState<string | null>()
  const [inviteRequired, setInviteRequired] = useState(true)

  const loadSession = useCallback(() => {
    auth.me().then((me) => {
      setInviteRequired(me.inviteRequired)
      setUser(me.user?.username ?? null)
      if (me.user) api.state().then(setState, (e) => setError(e.message))
    }, (e) => setError(e.message))
  }, [])

  useEffect(() => { loadSession() }, [loadSession])
  useEffect(() => {
    const onExpired = () => { setUser(null); setState(undefined) }
    window.addEventListener(AUTH_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EVENT, onExpired)
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(undefined)
    try {
      setState(await api.refresh())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await auth.logout().catch(() => {})
    setUser(null)
    setState(undefined)
  }, [])

  const view = state?.view
  // personagem aberto a partir de uma equipe conta como aba Equipes
  const { pathname, search } = useLocation()
  const inTeam = pathname.startsWith('/personagens/') && new URLSearchParams(search).has('equipe')
  if (user === undefined) return error ? <div className="shell"><div className="notice error">{error}</div></div> : null
  if (user === null) return <div className="shell"><Login inviteRequired={inviteRequired} onDone={loadSession} /></div>

  return (
    <AppCtx.Provider value={{ state, setState, refresh, refreshing, error, controls, setControls, logout }}>
      <div className="shell">
        <header className="top">
          <Link to="/hoje" className="brand" aria-label="Genshin Builder, ir para Hoje">
            <img src="/icon.svg" alt="" width="28" height="28" />
            <span>Genshin Builder</span>
          </Link>
          {view && (
            <span className="who" title={`UID ${view.uid}`}>
              {view.nickname}{view.level ? ` · AR ${view.level}` : ''}
              <small>atualizado {ago(view.fetchedAt)}</small>
            </span>
          )}
          {state?.uid && (
            <button className={`icon-btn ${refreshing ? 'spin' : ''}`} onClick={refresh} disabled={refreshing}
              aria-label="Buscar dados novos da conta" title="Buscar dados novos da conta">
              <Icon name="atualizar" />
            </button>
          )}
        </header>

        <nav className="tabs" aria-label="Seções">
          <NavLink to="/hoje"><Icon name="hoje" /><span>Hoje</span></NavLink>
          <NavLink to="/personagens" className={({ isActive }) => ((isActive || pathname === '/armas' || pathname === '/artefatos') && !inTeam ? 'active' : '')}>
            <Icon name="personagens" /><span>Personagens</span>
          </NavLink>
          <NavLink to="/equipes" className={({ isActive }) => (isActive || inTeam ? 'active' : '')}><Icon name="equipes" /><span>Equipes</span></NavLink>
          <NavLink to="/desejos"><Icon name="desejos" /><span>Desejos</span></NavLink>
          <NavLink to="/conta"><Icon name="conta" /><span>Conta</span></NavLink>
        </nav>

        <UpdateBanner />
        {error && <div className="notice error" role="alert">{error}</div>}
        {view?.warnings.map((w) => <div key={w} className="notice">{w}</div>)}

        {state && (
          <Routes>
            <Route path="/" element={<Navigate to={state.uid ? '/hoje' : '/conta'} replace />} />
            <Route path="/hoje" element={<Today />} />
            <Route path="/personagens" element={<Characters />} />
            <Route path="/personagens/:id" element={<CharacterDetail />} />
            <Route path="/armas" element={<Weapons />} />
            <Route path="/artefatos" element={<Artifacts />} />
            <Route path="/equipes" element={<Teams />} />
            <Route path="/desejos" element={<Wishes />} />
            <Route path="/mapa/:id" element={<MapPage />} />
            <Route path="/conta" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </AppCtx.Provider>
  )
}
