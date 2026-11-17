import type { AppState, CodesView, OptimizeResult, TodayView } from '../../shared/view-types'

/** disparado quando a sessão expira; o App volta para a tela de login */
export const AUTH_EVENT = 'gb:auth-required'

/** todas as chamadas da API passam por aqui: POST sempre vai como JSON (o servidor exige) */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const sendsBody = method !== 'GET' && method !== 'DELETE'
  const res = await fetch(`/api/${path}`, {
    method,
    headers: sendsBody ? { 'Content-Type': 'application/json' } : undefined,
    body: sendsBody ? JSON.stringify(body ?? {}) : undefined,
  }).catch(() => {
    throw new Error('Sem conexão com o servidor do app. Confira a internet e tente de novo.')
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && data.auth) window.dispatchEvent(new Event(AUTH_EVENT))
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
  return data
}

export const api = {
  state: () => request<AppState>('GET', 'state'),
  saveConfig: (cfg: { uid?: string; ltuid?: string; ltoken?: string; ltmid?: string }) => request<AppState>('POST', 'config', cfg),
  hoyolabLogin: () => request<AppState>('POST', 'hoyolab-login'),
  removeCookies: () => request<AppState>('DELETE', 'cookies'),
  refresh: () => request<AppState>('POST', 'refresh'),
}

export const today = (fresh = false) => request<TodayView>('GET', `today${fresh ? '?atualizar=1' : ''}`)
export const optimize = (teams: string[]) => request<OptimizeResult>('POST', 'optimize', { teams })

export interface Me { user: { username: string; hasRecovery?: boolean } | null; inviteRequired: boolean; recoveryCode?: string }
export const auth = {
  me: () => request<Me>('GET', 'auth/me'),
  login: (username: string, password: string) => request<Me>('POST', 'auth/login', { username, password }),
  signup: (username: string, password: string, invite: string) => request<Me>('POST', 'auth/signup', { username, password, invite }),
  logout: () => request<Me>('POST', 'auth/logout'),
  changePassword: (current: string, next: string) => request<{ ok: boolean }>('POST', 'auth/change-password', { current, next }),
  reset: (username: string, code: string, password: string) => request<Me>('POST', 'auth/reset', { username, code, password }),
  newRecoveryCode: (password: string) => request<{ recoveryCode: string }>('POST', 'auth/recovery-code', { password }),
  invite: () => request<{ invite: string | null }>('GET', 'auth/invite'),
  deleteAccount: (password: string) => request<Me>('POST', 'auth/delete-account', { password }),
}

export const codes = {
  list: () => request<CodesView>('GET', 'codes'),
  mark: (code: string, redeemed: boolean) => request<{ ok: boolean }>('POST', 'codes', { code, redeemed }),
}

export interface CaptchaChallenge { sessionId: string; version: 3 | 4; gt: string; challenge?: string; newCaptcha?: number; riskType?: string }
export const hoyolab = {
  login: (email: string, password: string, captcha?: Record<string, string>) =>
    request<{ captcha?: CaptchaChallenge; state?: AppState }>('POST', 'hoyolab/login', { email, password, captcha }),
}
