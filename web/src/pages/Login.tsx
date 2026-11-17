import { useState } from 'react'
import { auth } from '../api'

type Mode = 'entrar' | 'criar' | 'esqueci'

export function Login({ inviteRequired, onDone }: { inviteRequired: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('entrar')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  // código de recuperação recém-gerado: mostrado uma vez antes de entrar no app
  const [newCode, setNewCode] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      if (mode === 'entrar') {
        await auth.login(username.trim(), password)
        onDone()
      } else {
        const r = mode === 'criar'
          ? await auth.signup(username.trim(), password, invite.trim())
          : await auth.reset(username.trim(), code.trim(), password)
        if (r.recoveryCode) setNewCode(r.recoveryCode)
        else onDone()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (newCode) return <RecoveryCodeScreen code={newCode} onDone={onDone} />

  return (
    <div className="login">
      <h1>Genshin Builder</h1>
      <p className="muted">Equipes, armas, artefatos e farm para a sua conta de Genshin Impact.</p>

      <div className="role-tabs" role="group" aria-label="Entrar ou criar conta">
        <button type="button" className="chip" aria-pressed={mode === 'entrar'} onClick={() => setMode('entrar')}>Entrar</button>
        <button type="button" className="chip" aria-pressed={mode === 'criar'} onClick={() => setMode('criar')}>Criar conta</button>
      </div>

      <form className="panel" onSubmit={submit}>
        {mode === 'esqueci' && (
          <p style={{ marginTop: 0 }}>
            Use o <b>código de recuperação</b> que apareceu quando você criou a conta (ou que você gerou na aba Conta).
          </p>
        )}
        {mode === 'criar' && (
          <p style={{ marginTop: 0, fontSize: '0.9rem' }}>
            Já tem conta? Use <b>Entrar</b>. Criar conta é só para quem recebeu um convite.
          </p>
        )}
        {error && <div className="notice error" role="alert" style={{ marginTop: 0 }}>{error}</div>}
        <div className="field">
          <label htmlFor="user">Usuário</label>
          <input id="user" autoComplete="username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} />
          {mode === 'criar' && <span className="hint">Um apelido qualquer. Não pedimos e-mail nem nome.</span>}
        </div>
        {mode === 'esqueci' && (
          <div className="field">
            <label htmlFor="code">Código de recuperação</label>
            <input id="code" autoCapitalize="characters" autoComplete="off" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
          </div>
        )}
        <div className="field">
          <label htmlFor="pass">{mode === 'esqueci' ? 'Nova senha' : 'Senha'}</label>
          <input id="pass" type="password" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} required
            minLength={mode === 'entrar' ? undefined : 8} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode !== 'entrar' && <span className="hint">Pelo menos 8 caracteres.</span>}
        </div>
        {mode === 'criar' && inviteRequired && (
          <div className="field">
            <label htmlFor="invite">Código de convite</label>
            <input id="invite" required autoCapitalize="none" value={invite} onChange={(e) => setInvite(e.target.value)} />
            <span className="hint">
              Quem já usa o app encontra o código em Conta › Convidar alguém. Ele evita que estranhos criem contas.
            </span>
          </div>
        )}
        <div className="row">
          <button className="btn solid" type="submit" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : mode === 'criar' ? 'Criar conta' : 'Trocar senha e entrar'}
          </button>
          {mode === 'entrar' && <button type="button" className="link-btn" onClick={() => setMode('esqueci')}>Esqueci minha senha</button>}
          {mode === 'esqueci' && <button type="button" className="link-btn" onClick={() => setMode('entrar')}>Voltar</button>}
        </div>
      </form>
    </div>
  )
}

/** o código de recuperação aparece uma única vez: é o que substitui o "esqueci a senha" por e-mail */
function RecoveryCodeScreen({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true) } catch { /* sem área de transferência */ }
  }
  return (
    <div className="login">
      <h1>Guarde seu código</h1>
      <div className="panel">
        <p style={{ marginTop: 0 }}>
          Como o app não pede e-mail, este código é o único jeito de recuperar a senha se você esquecer.
          Guarde no gerenciador de senhas do celular ou tire um print. Ele aparece só agora.
        </p>
        <div className="code-value" style={{ fontSize: '1.4rem', margin: '10px 0' }}>{code}</div>
        <div className="row">
          <button className="btn ink" onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</button>
          <button className="btn solid" onClick={onDone}>Já guardei, continuar</button>
        </div>
      </div>
    </div>
  )
}
