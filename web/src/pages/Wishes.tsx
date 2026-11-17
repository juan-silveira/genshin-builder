import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BANNERS, BANNER_IDS, PITY4, PRIMOS_PER_PULL, applyAction, pullsFromBudget, pullsLeft, worstCaseFeatured,
  type BannerId, type BannerState, type FiveStar, type WishAction, type WishesState,
} from '../../../shared/wishes'
import { useApp } from '../App'
import { wishesApi } from '../wishesApi'

const fmt = (n: number) => n.toLocaleString('pt-BR')
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`

function loadTab(): BannerId {
  try {
    const t = localStorage.getItem('desejos-banner') as BannerId
    return BANNER_IDS.includes(t) ? t : 'character'
  } catch {
    return 'character'
  }
}

export function Wishes() {
  const [state, setState] = useState<WishesState>()
  const [error, setError] = useState<string>()
  const [tab, setTabState] = useState<BannerId>(loadTab)
  // ações vão em fila para que toques rápidos em +1 não se percam nem cheguem fora de ordem
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)

  const setTab = (t: BannerId) => {
    setTabState(t)
    try { localStorage.setItem('desejos-banner', t) } catch { /* vale só nesta sessão */ }
  }

  const reload = useCallback(() => {
    wishesApi.state().then(setState, (e) => setError(e.message))
  }, [])

  useEffect(() => {
    reload()
    // ao voltar para o app, pega o que foi marcado no outro aparelho
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const act = useCallback((action: WishAction): Promise<boolean> => {
    setError(undefined)
    // mostra na hora; a resposta do servidor confirma
    setState((s) => {
      if (!s) return s
      try { return applyAction(s, action) } catch { return s }
    })
    pending.current++
    const run = queue.current.then(async () => {
      try {
        const next = await wishesApi.act(action)
        // com toques ainda na fila, mantém a prévia local para o número não voltar atrás
        if (pending.current === 1) setState(next)
        return true
      } catch (e: any) {
        setError(e.message)
        reload()
        return false
      } finally {
        pending.current--
      }
    })
    queue.current = run
    return run
  }, [reload])

  return (
    <>
      <h2 className="section">Desejos</h2>
      <p className="muted" style={{ marginTop: -6, fontSize: '0.88rem' }}>
        Marque logo depois de desejar no jogo. Fica salvo na sua conta, igual em todos os aparelhos.
      </p>

      <div className="filters" role="group" aria-label="Banner">
        {BANNER_IDS.map((id) => (
          <button key={id} className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {BANNERS[id].label}
          </button>
        ))}
      </div>

      {error && <div className="notice error" role="alert">{error}</div>}
      {!error && state?.updatedAt && pending.current === 0 && (
        <p className="saved-note">
          Salvo na sua conta às {new Date(state.updatedAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}.
          Qualquer aparelho em que você entrar vê os mesmos números.
        </p>
      )}

      {state ? (
        <>
          <BannerPanel key={tab} id={tab} b={state.banners[tab]} act={act} />
          <History id={tab} history={state.banners[tab].history} />
          <Calculator id={tab} b={state.banners[tab]} />
        </>
      ) : !error && <p className="muted">Carregando…</p>}
    </>
  )
}

type Act = (a: WishAction) => Promise<boolean>

function statusLine(id: BannerId, b: BannerState): { text: string; secured: boolean } {
  const info = BANNERS[id]
  if (info.mode === 'none') return { text: 'Sem 50/50: o 5★ é qualquer um do banner padrão.', secured: false }
  if (info.mode === 'fate') {
    return b.fatePoint >= 1
      ? { text: 'Ponto de Destino 1/1: o próximo 5★ é a arma escolhida.', secured: true }
      : { text: 'Ponto de Destino 0/1: o próximo 5★ pode não ser a arma escolhida.', secured: false }
  }
  const what = id === 'character' ? 'o personagem do banner' : 'o escolhido na Crônica'
  return b.guaranteed
    ? { text: `Garantido: próximo 5★ é ${what}.`, secured: true }
    : { text: `50/50: o próximo 5★ pode ser ${what} ou outro.`, secured: false }
}

function BannerPanel({ id, b, act }: { id: BannerId; b: BannerState; act: Act }) {
  const info = BANNERS[id]
  const [form, setForm] = useState<'five' | 'edit'>()
  const left = pullsLeft(b, id)
  const status = statusLine(id, b)
  const worst = worstCaseFeatured(b, id)
  const pct = Math.min(100, (b.pity5 / info.hard) * 100)
  const lastUndo = b.undo.at(-1)

  const pull = (count: number) => {
    navigator.vibrate?.(12)
    act({ type: 'pull', banner: id, count })
  }

  return (
    <section className="panel wish" aria-label={info.label}>
      <div className="wish-head">
        <h3>{info.label}</h3>
        <span className="muted">{plural(b.total, 'tiro', 'tiros')} no total</span>
      </div>

      <div className="wish-pity">
        <span className="wish-num">{b.pity5}</span>
        <span className="wish-of">/ {info.hard}</span>
        <span className="wish-cap">tiros desde o último 5★</span>
      </div>

      <div
        className={`wish-bar ${b.pity5 >= info.soft ? 'soft' : ''}`}
        role="progressbar" aria-valuemin={0} aria-valuemax={info.hard} aria-valuenow={b.pity5}
        aria-label={`Pity ${b.pity5} de ${info.hard}`}
      >
        <span className="fill" style={{ width: `${pct}%` }} />
        <span className="mark" style={{ left: `${(info.soft / info.hard) * 100}%` }} />
      </div>
      <div className="wish-scale">
        <span>0</span>
        <span style={{ left: `${(info.soft / info.hard) * 100}%` }}>suave ~{info.soft}</span>
        <span>{info.hard}</span>
      </div>

      <p className={`wish-status ${status.secured ? 'secured' : ''}`}>{status.text}</p>
      {id === 'character' && (
        <p className="wish-note">
          Captura Radiante: {plural(b.lossStreak, 'derrota seguida', 'derrotas seguidas')} no 50/50.
          {b.lossStreak > 0 && ' Depois de perder, a chance de ganhar o próximo 50/50 aumenta.'}
        </p>
      )}
      {id === 'weapon' && <p className="wish-note">Escolha a arma no Caminho Epitomizado antes de desejar.</p>}

      {b.pity5 >= info.hard ? (
        <div className="notice error">Você já passou do limite: registre o 5★ que saiu em “Saiu 5★”.</div>
      ) : (
        <ul className="wish-facts">
          <li>
            Faltam <b>{plural(left, 'tiro', 'tiros')}</b> para o 5★ garantido ({fmt(left * PRIMOS_PER_PULL)} primogemas).
          </li>
          {b.pity5 >= info.soft && <li>Você está no pity suave: a chance de 5★ sobe a cada tiro.</li>}
          {worst !== undefined && worst > left && (
            <li>Para garantir {info.mode === 'fate' ? 'a arma escolhida' : 'o 5★ do banner'} no pior caso: {plural(worst, 'tiro', 'tiros')} ({fmt(worst * PRIMOS_PER_PULL)} primogemas).</li>
          )}
        </ul>
      )}

      <div className="wish-four">
        <span>4★: <b>{b.pity4}/{PITY4}</b></span>
        <span className="wish-dots" aria-hidden>
          {Array.from({ length: PITY4 }, (_, i) => <i key={i} className={i < b.pity4 ? 'on' : ''} />)}
        </span>
      </div>
      {b.pity4 >= PITY4 && <p className="wish-note">Passou de 10 sem 4★? Toque em “Saiu 4★” quando ele vier.</p>}

      <div className="wish-pulls">
        <button className="wish-btn big" onClick={() => pull(1)}>+1 tiro</button>
        <button className="wish-btn big" onClick={() => pull(10)}>+10 tiros</button>
      </div>
      <div className="wish-actions">
        <button className="wish-btn four" onClick={() => act({ type: 'four', banner: id })}>Saiu 4★</button>
        <button className="wish-btn five" aria-expanded={form === 'five'} onClick={() => setForm(form === 'five' ? undefined : 'five')}>Saiu 5★</button>
        <button
          className="wish-btn ghost" disabled={!lastUndo}
          title={lastUndo ? `Desfazer: ${lastUndo.label}` : 'Nada para desfazer'}
          onClick={() => act({ type: 'undo', banner: id })}
        >
          Desfazer
        </button>
      </div>
      {lastUndo && <p className="wish-undo muted">Último: {lastUndo.label}</p>}

      {form === 'five' && <FiveForm id={id} b={b} act={act} onDone={() => setForm(undefined)} />}

      <button className="wish-link" aria-expanded={form === 'edit'} onClick={() => setForm(form === 'edit' ? undefined : 'edit')}>
        {form === 'edit' ? 'Fechar correção' : 'Corrigir números'}
      </button>
      {form === 'edit' && <EditForm id={id} b={b} act={act} onDone={() => setForm(undefined)} />}
    </section>
  )
}

function FiveForm({ id, b, act, onDone }: { id: BannerId; b: BannerState; act: Act; onDone: () => void }) {
  const info = BANNERS[id]
  const { state } = useApp()
  const [name, setName] = useState('')
  const [featured, setFeatured] = useState<boolean>()
  const [after, setAfter] = useState(0)
  const secured = info.mode === 'fifty' ? b.guaranteed : info.mode === 'fate' ? b.fatePoint >= 1 : false
  const ask = info.mode !== 'none' && !secured
  const maxAfter = Math.max(0, Math.min(9, b.pity5 - 1))

  const suggestions = [...new Set(
    (state?.view?.characters ?? []).flatMap((c) => (id === 'weapon' ? (c.weapon ? [c.weapon.name] : []) : [c.name])),
  )].sort((a, z) => a.localeCompare(z, 'pt-BR'))

  const yes = id === 'character' ? 'Sim, o do banner' : id === 'weapon' ? 'Sim, a escolhida' : 'Sim, o escolhido'
  const no = id === 'weapon' ? 'Não, veio outra' : 'Não, perdi o 50/50'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await act({ type: 'five', banner: id, name: name.trim(), featured: ask ? featured : undefined, after })
    if (ok) onDone()
  }

  if (b.pity5 < 1) return <p className="wish-note">Marque os tiros primeiro (+1 ou +10) e depois registre o 5★.</p>

  return (
    <form className="wish-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="wish-name">{id === 'weapon' ? 'Qual arma?' : 'Qual personagem?'}</label>
        <input id="wish-name" list="wish-names" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" required />
        <datalist id="wish-names">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>

      {ask && (
        <div className="field">
          <span className="label">{id === 'weapon' ? 'Foi a arma escolhida no Caminho?' : 'Foi o 5★ do banner?'}</span>
          <div className="row">
            <button type="button" className="chip chip-light" aria-pressed={featured === true} onClick={() => setFeatured(true)}>{yes}</button>
            <button type="button" className="chip chip-light" aria-pressed={featured === false} onClick={() => setFeatured(false)}>{no}</button>
          </div>
        </div>
      )}
      {secured && <p className="wish-note">Com a garantia, este 5★ conta como o do banner.</p>}

      {maxAfter > 0 && (
        <div className="field">
          <label htmlFor="wish-after">Tiros depois dele na mesma leva</label>
          <input
            id="wish-after" type="number" inputMode="numeric" min={0} max={maxAfter}
            value={after} onChange={(e) => setAfter(Math.max(0, Math.min(maxAfter, Number(e.target.value) || 0)))}
          />
          <span className="hint">No +10, conte quantos vieram depois do 5★ (eles já contam para o próximo). No +1, deixe 0.</span>
        </div>
      )}

      <div className="row">
        <button className="wish-btn five" type="submit" disabled={!name.trim() || (ask && featured === undefined)}>
          Salvar 5★ no tiro {b.pity5 - after}
        </button>
        <button type="button" className="wish-btn ghost" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  )
}

function EditForm({ id, b, act, onDone }: { id: BannerId; b: BannerState; act: Act; onDone: () => void }) {
  const info = BANNERS[id]
  const [v, setV] = useState({
    pity5: String(b.pity5), pity4: String(b.pity4), total: String(b.total),
    guaranteed: b.guaranteed, lossStreak: String(b.lossStreak), fatePoint: b.fatePoint >= 1,
  })
  const num = (k: 'pity5' | 'pity4' | 'total' | 'lossStreak', label: string, max: number, hint?: string) => (
    <div className="field">
      <label htmlFor={`wish-${k}`}>{label}</label>
      <input
        id={`wish-${k}`} type="number" inputMode="numeric" min={0} max={max}
        value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await act({
      type: 'set', banner: id,
      pity5: Number(v.pity5), pity4: Number(v.pity4), total: Number(v.total),
      ...(info.mode === 'fifty' ? { guaranteed: v.guaranteed } : {}),
      ...(id === 'character' ? { lossStreak: Number(v.lossStreak) } : {}),
      ...(info.mode === 'fate' ? { fatePoint: v.fatePoint ? 1 : 0 } : {}),
    })
    if (ok) onDone()
  }

  return (
    <form className="wish-form" onSubmit={submit}>
      <p className="wish-note">Use para colocar o pity que você já tinha. No jogo, conte no histórico de desejos quantos tiros vieram desde o último 5★.</p>
      {num('pity5', 'Tiros desde o último 5★', info.hard - 1)}
      {num('pity4', 'Tiros desde o último 4★', PITY4 - 1)}
      {num('total', 'Total de tiros', 1_000_000, 'Só para a sua estatística.')}
      {info.mode === 'fifty' && (
        <label className="wish-check">
          <input type="checkbox" checked={v.guaranteed} onChange={(e) => setV({ ...v, guaranteed: e.target.checked })} />
          Perdi o último 50/50 (o próximo 5★ é garantido)
        </label>
      )}
      {id === 'character' && num('lossStreak', 'Derrotas seguidas no 50/50', 10)}
      {info.mode === 'fate' && (
        <label className="wish-check">
          <input type="checkbox" checked={v.fatePoint} onChange={(e) => setV({ ...v, fatePoint: e.target.checked })} />
          Tenho 1 Ponto de Destino
        </label>
      )}
      <div className="row">
        <button className="wish-btn five" type="submit">Salvar números</button>
        <button type="button" className="wish-btn ghost" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  )
}

const RESULT_LABEL = { won: 'ganhou', lost: 'perdeu', guaranteed: 'garantido' } as const

function History({ id, history }: { id: BannerId; history: FiveStar[] }) {
  if (!history.length) return null
  const avg = history.reduce((s, h) => s + h.pity, 0) / history.length
  const weapon = id === 'weapon'
  return (
    <section className="panel">
      <h3>5★ neste banner ({history.length})</h3>
      <p className="muted" style={{ margin: '-4px 0 10px', fontSize: '0.9rem' }}>
        Média de {fmt(Math.round(avg * 10) / 10)} tiros por 5★.
      </p>
      <ol className="wish-history">
        {[...history].reverse().map((h, i) => (
          <li key={history.length - i}>
            <span className="name">{h.name}</span>
            <span className="meta">
              {h.date.split('-').reverse().join('/')} · tiro {h.pity}
              {h.result && (
                <span className={`wish-tag ${h.result}`}>
                  {h.result === 'guaranteed' ? 'garantido' : weapon ? (h.result === 'won' ? 'escolhida' : 'outra') : `${RESULT_LABEL[h.result]} 50/50`}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Calculator({ id, b }: { id: BannerId; b: BannerState }) {
  const [primos, setPrimos] = useState('')
  const [fates, setFates] = useState('')
  const info = BANNERS[id]
  const pulls = pullsFromBudget(Number(primos) || 0, Number(fates) || 0)
  const left = pullsLeft(b, id)
  const worst = worstCaseFeatured(b, id)
  const touched = primos !== '' || fates !== ''

  return (
    <section className="panel">
      <h3>Calculadora</h3>
      <div className="wish-calc">
        <div className="field">
          <label htmlFor="calc-primos">Primogemas</label>
          <input id="calc-primos" type="number" inputMode="numeric" min={0} value={primos} onChange={(e) => setPrimos(e.target.value)} placeholder="0" />
        </div>
        <div className="field">
          <label htmlFor="calc-fates">Destinos</label>
          <input id="calc-fates" type="number" inputMode="numeric" min={0} value={fates} onChange={(e) => setFates(e.target.value)} placeholder="0" />
        </div>
      </div>
      {touched ? (
        <ul className="wish-facts">
          <li>Dá <b>{plural(pulls, 'tiro', 'tiros')}</b>.</li>
          <li>
            {pulls >= left
              ? `Chega ao 5★ garantido neste banner (faltam ${plural(left, 'tiro', 'tiros')}).`
              : `Não chega ao 5★ garantido: faltam mais ${plural(left - pulls, 'tiro', 'tiros')} (${fmt((left - pulls) * PRIMOS_PER_PULL)} primogemas).`}
          </li>
          {worst !== undefined && worst > left && (
            <li>
              {pulls >= worst
                ? `Cobre até o pior caso: garante ${info.mode === 'fate' ? 'a arma escolhida' : 'o 5★ do banner'}.`
                : `Para garantir ${info.mode === 'fate' ? 'a arma escolhida' : 'o 5★ do banner'} no pior caso faltam ${plural(worst - pulls, 'tiro', 'tiros')}.`}
            </li>
          )}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>Cada tiro custa {PRIMOS_PER_PULL} primogemas ou 1 destino.</p>
      )}
    </section>
  )
}
