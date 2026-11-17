import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONTROL_LABEL, type ControlScheme } from '../../../shared/controls'
import { useApp } from '../App'
import { api, auth, hoyolab } from '../api'
import { solveCaptcha } from '../geetest'
import { APP_VERSION, hardRefresh, serverVersion } from '../pwa'

export function Settings() {
  const { state } = useApp()
  return (
    <>
      <h2 className="section">Conta</h2>
      <GenshinAccount />
      <ControlsPanel />
      <VersionPanel />
      <AccountPanel username={state?.username} />
    </>
  )
}

/** conexão com o jogo: login da HoYoLAB (recomendado) ou só o UID */
function GenshinAccount() {
  const { state, setState, refresh } = useApp()
  const navigate = useNavigate()
  const connected = !!state?.hasCookies
  const [editing, setEditing] = useState(!connected)
  const [mode, setMode] = useState<'hoyolab' | 'uid'>('hoyolab')
  const [msg, setMsg] = useState<{ error?: boolean; text: string }>()

  useEffect(() => { setEditing(!state?.hasCookies) }, [state?.hasCookies])

  async function afterConnect() {
    setMsg({ text: 'Conectado. Carregando seus personagens…' })
    await refresh()
    navigate('/hoje')
  }

  async function disconnect() {
    setState(await api.removeCookies())
    setMsg({ text: 'HoYoLAB desconectada. O app passa a usar só a Vitrine do perfil (pelo UID).' })
  }

  return (
    <section className="panel">
      <h3>Conta do Genshin</h3>
      {msg && <div className={`notice ${msg.error ? 'error' : ''}`} style={{ marginTop: 0 }}>{msg.text}</div>}

      {connected && !editing ? (
        <>
          <p style={{ marginTop: 0 }}>
            <span className="status-ok">✓ Conectada à HoYoLAB</span>
            {state?.uid && <> · UID <b>{state.uid}</b></>}
          </p>
          <p className="sub" style={{ fontSize: '0.88rem' }}>
            O app lê todos os seus personagens, a resina e o Abismo pelo Diário de Batalha. Só leitura: não mexe no jogo.
          </p>
          <div className="row">
            <button className="btn ink" onClick={() => setEditing(true)}>Reconectar</button>
            <button className="btn danger" onClick={disconnect}>Desconectar</button>
          </div>
        </>
      ) : (
        <>
          <div className="role-tabs" role="group" aria-label="Como conectar" style={{ marginTop: 0 }}>
            <button className="chip chip-light" aria-pressed={mode === 'hoyolab'} onClick={() => setMode('hoyolab')}>Entrar com a HoYoLAB</button>
            <button className="chip chip-light" aria-pressed={mode === 'uid'} onClick={() => setMode('uid')}>Só o UID</button>
          </div>
          {mode === 'hoyolab'
            ? <HoyolabLogin onDone={afterConnect} onError={(t) => setMsg({ error: true, text: t })} />
            : <UidOnly onDone={afterConnect} onError={(t) => setMsg({ error: true, text: t })} />}
          {connected && <button className="btn ink" style={{ marginTop: 12 }} onClick={() => setEditing(false)}>Cancelar</button>}
          <ManualCookies onDone={afterConnect} onError={(t) => setMsg({ error: true, text: t })} />
        </>
      )}
    </section>
  )
}

function HoyolabLogin({ onDone, onError }: { onDone: () => void; onError: (t: string) => void }) {
  const { setState } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      let r = await hoyolab.login(email, password)
      if (r.captcha) {
        // a HoYoverse pediu captcha: resolve e envia de novo
        const solved = await solveCaptcha(r.captcha)
        r = await hoyolab.login(email, password, solved)
      }
      if (r.captcha) throw new Error('A HoYoverse pediu outro captcha. Tente entrar de novo.')
      if (r.state) setState(r.state)
      setPassword('')
      onDone()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <p style={{ marginTop: 12 }}>
        Use o e-mail e a senha da sua conta HoYoverse (a mesma do site HoYoLAB). Assim o app vê <b>todos</b> os personagens,
        a resina e o Abismo, e descobre o UID sozinho.
      </p>
      <div className="field">
        <label htmlFor="hemail">E-mail da HoYoverse</label>
        <input id="hemail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="hpass">Senha da HoYoverse</label>
        <input id="hpass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="hint">
          A senha vai direto para o login oficial da HoYoverse e não é guardada. O app guarda só um acesso de leitura
          (cifrado), que não deixa ninguém jogar, trocar senha nem gastar nada. Se a HoYoverse pedir, resolva o captcha.
        </span>
      </div>
      <p className="sub" style={{ fontSize: '0.84rem' }}>
        Antes, no site da HoYoLAB: Perfil › Diário de Batalha › Configurações › ative <b>Mostrar detalhes do personagem</b> e{' '}
        <b>Notas em Tempo Real</b>.
      </p>
      <button className="btn solid" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar com a HoYoLAB'}</button>
    </form>
  )
}

function UidOnly({ onDone, onError }: { onDone: () => void; onError: (t: string) => void }) {
  const { state, setState } = useApp()
  const [uid, setUid] = useState(state?.uid ?? '')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setState(await api.saveConfig({ uid: uid.trim() }))
      onDone()
    } catch (err: any) {
      onError(err.message)
    }
  }
  return (
    <form onSubmit={submit}>
      <p style={{ marginTop: 12 }}>
        Sem login: o app lê só os personagens da <b>Vitrine</b> do perfil (até 12). O UID fica no canto inferior direito da tela do jogo.
      </p>
      <div className="field">
        <label htmlFor="uid">UID</label>
        <input id="uid" inputMode="numeric" pattern="\d{9,10}" required value={uid} onChange={(e) => setUid(e.target.value)} placeholder="ex.: 612345678" />
        <span className="hint">No jogo: Menu › Perfil › Vitrine de Personagens › ative "Mostrar detalhes do personagem".</span>
      </div>
      <button className="btn solid" type="submit">Salvar e carregar</button>
    </form>
  )
}

/** jeito antigo, para quem prefere não digitar a senha no app */
function ManualCookies({ onDone, onError }: { onDone: () => void; onError: (t: string) => void }) {
  const { setState } = useApp()
  const [ltuid, setLtuid] = useState('')
  const [ltoken, setLtoken] = useState('')
  const [ltmid, setLtmid] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setState(await api.saveConfig({ ltuid, ltoken, ltmid }))
      onDone()
    } catch (err: any) {
      onError(err.message)
    }
  }
  return (
    <details className="explainer" style={{ marginTop: 16 }}>
      <summary>Prefere não digitar a senha? Colar os cookies (avançado, pelo computador)</summary>
      <form onSubmit={submit}>
        <ol className="steps">
          <li>No computador, entre em <code>hoyolab.com</code>.</li>
          <li>Aperte <code>F12</code> › aba <b>Aplicativo</b> › Cookies › <code>https://www.hoyolab.com</code>.</li>
          <li>Copie <code>ltuid_v2</code>, <code>ltoken_v2</code> e <code>ltmid_v2</code> para os campos abaixo.</li>
        </ol>
        <div className="field"><label htmlFor="ltuid">ltuid_v2</label><input id="ltuid" required value={ltuid} onChange={(e) => setLtuid(e.target.value)} autoComplete="off" /></div>
        <div className="field"><label htmlFor="ltoken">ltoken_v2</label><input id="ltoken" required value={ltoken} onChange={(e) => setLtoken(e.target.value)} autoComplete="off" /></div>
        <div className="field"><label htmlFor="ltmid">ltmid_v2</label><input id="ltmid" value={ltmid} onChange={(e) => setLtmid(e.target.value)} autoComplete="off" /></div>
        <button className="btn ink" type="submit">Salvar cookies</button>
      </form>
    </details>
  )
}

function ControlsPanel() {
  const { controls, setControls } = useApp()
  return (
    <section className="panel">
      <h3>Controle</h3>
      <p style={{ marginTop: 0 }}>As rotações e dicas mostram os botões do controle escolhido.</p>
      <div className="row" role="group" aria-label="Controle">
        {(Object.keys(CONTROL_LABEL) as ControlScheme[]).map((c) => (
          <button key={c} type="button" className="chip chip-light" aria-pressed={controls === c} onClick={() => setControls(c)}>
            {CONTROL_LABEL[c]}
          </button>
        ))}
      </div>
    </section>
  )
}

function AccountPanel({ username }: { username?: string }) {
  const { logout } = useApp()
  const [invite, setInvite] = useState<string | null>()
  const [copied, setCopied] = useState(false)
  const [panel, setPanel] = useState<'senha' | 'recuperacao' | 'apagar'>()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [code, setCode] = useState<string>()
  const [msg, setMsg] = useState<{ error?: boolean; text: string }>()

  useEffect(() => { auth.invite().then((r) => setInvite(r.invite), () => setInvite(null)) }, [])

  const close = () => { setPanel(undefined); setCurrent(''); setNext('') }
  const run = async (fn: () => Promise<void>) => {
    setMsg(undefined)
    try { await fn() } catch (e: any) { setMsg({ error: true, text: e.message }) }
  }
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(invite!); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* sem área de transferência */ }
  }

  return (
    <section className="panel" style={{ marginTop: 28 }}>
      <h3>Sua conta no app</h3>
      <p style={{ marginTop: 0 }}>Você entrou como <b>{username}</b>. O app não guarda e-mail, nome nem foto.</p>

      {invite && (
        <div className="invite">
          <div>
            <div className="sub">Convidar alguém: a pessoa abre o app, toca em <b>Criar conta</b> e usa este código.</div>
            <div className="code-value">{invite}</div>
          </div>
          <button className="btn ink" onClick={copyInvite}>{copied ? 'Copiado' : 'Copiar código'}</button>
        </div>
      )}

      {msg && <div className={`notice ${msg.error ? 'error' : ''}`}>{msg.text}</div>}
      {code && (
        <div className="recovery">
          <div className="sub">Seu código de recuperação (aparece só agora; guarde no gerenciador de senhas ou tire um print):</div>
          <div className="code-value">{code}</div>
          <button className="btn ink" onClick={() => setCode(undefined)}>Já guardei</button>
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ink" onClick={logout}>Sair</button>
        <button className="btn ink" onClick={() => setPanel('senha')}>Trocar senha</button>
        <button className="btn ink" onClick={() => setPanel('recuperacao')}>Código de recuperação</button>
        <button className="btn danger" onClick={() => setPanel('apagar')}>Apagar conta e dados</button>
      </div>

      {panel && (
        <div style={{ marginTop: 14 }}>
          {panel === 'senha' && <p className="sub" style={{ margin: 0 }}>Os outros aparelhos vão pedir a senha nova.</p>}
          {panel === 'recuperacao' && <p className="sub" style={{ margin: 0 }}>Gera um código novo para recuperar a senha sem e-mail. O anterior deixa de valer.</p>}
          {panel === 'apagar' && <p className="sub" style={{ margin: 0 }}>Apaga tudo (UID, cookies, desejos, marcações). Não dá para desfazer.</p>}
          <div className="field">
            <label htmlFor="pwcur">Senha atual do app</label>
            <input id="pwcur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          {panel === 'senha' && (
            <div className="field">
              <label htmlFor="pwnew">Nova senha</label>
              <input id="pwnew" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
          )}
          <div className="row">
            {panel === 'senha' && (
              <button className="btn ink" disabled={!current || next.length < 8}
                onClick={() => run(async () => { await auth.changePassword(current, next); close(); setMsg({ text: 'Senha trocada.' }) })}>Salvar senha</button>
            )}
            {panel === 'recuperacao' && (
              <button className="btn ink" disabled={!current}
                onClick={() => run(async () => { const r = await auth.newRecoveryCode(current); setCode(r.recoveryCode); close() })}>Gerar código</button>
            )}
            {panel === 'apagar' && (
              <button className="btn danger" disabled={!current}
                onClick={() => run(async () => { await auth.deleteAccount(current); await logout() })}>Apagar definitivamente</button>
            )}
            <button className="btn ink" onClick={close}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}

/** versão do app no aparelho x publicada, e o botão que limpa o cache e recarrega */
function VersionPanel() {
  const [latest, setLatest] = useState<string | null>()
  const [busy, setBusy] = useState(false)
  useEffect(() => { serverVersion().then(setLatest) }, [])
  const outdated = !!latest && latest !== APP_VERSION
  return (
    <section className="panel">
      <h3>Versão do app</h3>
      <p style={{ marginTop: 0 }}>
        Neste aparelho: <b>{APP_VERSION}</b>
        {latest && <> · publicada: <b>{latest}</b></>}
        {latest === APP_VERSION && <span className="status-ok"> · ✓ atualizado</span>}
        {outdated && <span style={{ color: 'var(--warn)', fontWeight: 700 }}> · desatualizado</span>}
      </p>
      <p className="sub" style={{ fontSize: '0.86rem' }}>
        O app se atualiza sozinho ao abrir. Se algo parecer antigo, este botão apaga a cópia guardada no aparelho e
        baixa a versão mais nova. Seus dados (conta, desejos, marcações) ficam no servidor e não se perdem.
      </p>
      <button className="btn ink" disabled={busy} onClick={() => { setBusy(true); hardRefresh() }}>
        {busy ? 'Atualizando…' : 'Atualizar o app (limpar cache)'}
      </button>
    </section>
  )
}
