import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CodesView, DailyNote, TodayView } from '../../../shared/view-types'
import { useApp } from '../App'
import { codes as codesApi, today as fetchToday } from '../api'
import { Count, DOMAIN_HINT, EmptyAccount, Icon, Info, MapLink, hideImg } from '../components'

const fmtDuration = (secs: number) => {
  if (secs <= 0) return 'cheio'
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`
}

const fmtClock = (secs: number) =>
  new Date(Date.now() + secs * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Today() {
  const { state } = useApp()
  const [data, setData] = useState<TodayView>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const load = (fresh = false) => {
    setLoading(true)
    fetchToday(fresh).then(setData, (e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { if (state?.view) load() }, [state?.view?.fetchedAt])

  if (!state?.view?.characters.length) return <><Codes /><EmptyAccount /></>
  if (error) return <div className="notice error">{error}</div>
  if (!data) return <p className="muted">Carregando…</p>

  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  return (
    <>
      <h2 className="section day-title">{data.weekdayName}<small>{today}</small></h2>

      {data.note ? <Notes note={data.note} onRefresh={() => load(true)} loading={loading} /> : (
        <section className="panel compact">
          <h3>Resina e comissões</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{data.noteError}</p>
        </section>
      )}

      <Codes />

      <h2 className="section">Farm de hoje{data.farmToday.length > 0 && <Count n={data.farmToday.length} />}</h2>
      <Info label="Como funciona e como chegar">
        <p>
          Domínios abertos hoje com materiais que faltam para os personagens das suas melhores equipes
          ({data.focus.map((c) => c.name).join(', ')}).
        </p>
        <p>{DOMAIN_HINT}</p>
        <p>
          Para explorar o mapa todo, use o <a href="https://act.hoyolab.com/ys/app/interactive-map/index.html?lang=pt-pt" target="_blank" rel="noopener noreferrer">mapa interativo oficial</a>.
        </p>
      </Info>
      {data.farmToday.length ? data.farmToday.map((g) => (
        <section key={g.where} className="panel">
          <h3 className="domain-title">{g.where}</h3>
          <ul className="farm-list">
            {g.materials.map((m) => (
              <li key={m.name}>
                {m.icon && <img src={m.icon} alt="" loading="lazy" onError={hideImg} />}
                <div>
                  <div><b>{m.count}×</b> {m.name}</div>
                  <div className="who">
                    para {m.forChars.map((c) => <Link key={c.id} to={`/personagens/${c.id}`}>{c.name}</Link>)}
                  </div>
                  {m.mapUrl && <MapLink url={m.mapUrl} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )) : (
        <section className="panel compact"><p style={{ margin: 0 }}>Nada pendente nos domínios abertos hoje. Aproveite a resina em artefatos ou chefes.</p></section>
      )}

      {data.weekly.length > 0 && (
        <>
          <h2 className="section">Chefes semanais<Count n={data.weekly.length} /></h2>
          <section className="panel">
            <ul className="farm-list">
              {data.weekly.map((w) => (
                <li key={w.name}>
                  {w.icon && <img src={w.icon} alt="" loading="lazy" onError={hideImg} />}
                  <div>
                    <div><b>{w.count}×</b> {w.name}</div>
                    <div className="sub" style={{ fontSize: '0.84rem' }}>{w.where} · para {w.forChars.join(', ')}</div>
                    {w.mapUrl && <MapLink url={w.mapUrl} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}

function Notes({ note, onRefresh, loading }: { note: DailyNote; onRefresh: () => void; loading: boolean }) {
  const resinPct = Math.round((note.resin / note.maxResin) * 100)
  const doneExp = note.expeditions.filter((e) => e.done).length
  return (
    <section className="panel notes">
      <div className="resin">
        <div>
          <div className="big">{note.resin}<span>/{note.maxResin}</span></div>
          <div className="sub">Resina Original</div>
        </div>
        <div className="sub" style={{ textAlign: 'right' }}>
          {note.resinFullIn > 0 ? <>Enche em {fmtDuration(note.resinFullIn)}<br />(às {fmtClock(note.resinFullIn)})</> : 'Resina cheia — use agora'}
        </div>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={note.resin} aria-valuemax={note.maxResin} aria-label="Resina">
        <span style={{ width: `${resinPct}%` }} />
      </div>
      <dl className="kv" style={{ marginTop: 14 }}>
        <dt>Comissões</dt>
        <dd>
          {note.commissionsDone}/{note.commissionsTotal}
          {note.commissionsDone >= note.commissionsTotal && !note.commissionRewardClaimed && ' — falta pegar a recompensa com a Katheryne'}
        </dd>
        <dt>Expedições</dt>
        <dd>{doneExp ? `${doneExp} prontas para coletar` : note.expeditions.length ? `Próxima em ${fmtDuration(Math.min(...note.expeditions.map((e) => e.remaining)))}` : 'Nenhuma em andamento'} ({note.expeditions.length}/{note.expeditionsMax})</dd>
        <dt>Moeda do Reino</dt>
        <dd>{note.realmCurrency}/{note.realmCurrencyMax}{note.realmCurrencyFullIn > 0 ? ` · enche em ${fmtDuration(note.realmCurrencyFullIn)}` : ' · cheia'}</dd>
        <dt>Chefes semanais</dt>
        <dd>{note.weeklyBossDiscounts} de {note.weeklyBossDiscountsMax} com desconto restantes</dd>
        {note.transformerReady !== undefined && (
          <>
            <dt>Transformador</dt>
            <dd>{note.transformerReady ? 'Pronto para usar' : 'Recarregando'}</dd>
          </>
        )}
      </dl>
      <button className="btn ink small" style={{ marginTop: 12 }} onClick={onRefresh} disabled={loading}>
        {loading ? 'Atualizando…' : 'Atualizar notas'}
      </button>
    </section>
  )
}

/** códigos de resgate ativos: copiar, abrir o site oficial já preenchido e marcar como resgatado */
function Codes() {
  const [data, setData] = useState<CodesView>()
  const [copied, setCopied] = useState<string>()
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { codesApi.list().then(setData, () => setData({ codes: [], error: 'Não consegui carregar os códigos.' })) }, [])
  if (!data) return null

  const mark = (code: string, redeemed: boolean) => {
    setData((d) => d && { ...d, codes: d.codes.map((c) => (c.code === code ? { ...c, redeemed } : c)) })
    codesApi.mark(code, redeemed).catch(() => {})
  }
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(undefined), 1500) } catch { /* sem área de transferência */ }
  }

  const pending = data.codes.filter((c) => !c.redeemed)
  const done = data.codes.filter((c) => c.redeemed)
  const visible = showAll ? pending : pending.slice(0, 2)
  const item = (c: CodesView['codes'][number]) => (
    <li key={c.code} className="code-row">
      <div className="code-main">
        <div className="code-value">{c.code}</div>
        <div className="code-rewards">{c.rewards.map((r) => `${r.count.toLocaleString('pt-BR')}× ${r.name}`).join(' · ')}</div>
      </div>
      <div className="code-actions">
        {!c.redeemed && (
          <a className="btn solid small" href={c.url} target="_blank" rel="noopener noreferrer" onClick={() => copy(c.code)}
            title="Abre o site oficial com o código preenchido (e copia o código)">
            {copied === c.code ? 'Copiado' : 'Resgatar'}
          </a>
        )}
        <button className={`icon-btn small ${c.redeemed ? 'done' : ''}`} onClick={() => mark(c.code, !c.redeemed)}
          aria-label={c.redeemed ? `Desmarcar ${c.code}` : `Marcar ${c.code} como resgatado`} title={c.redeemed ? 'Desmarcar' : 'Já resgatei'}>
          <Icon name="check" size={18} />
        </button>
      </div>
    </li>
  )

  return (
    <>
      <h2 className="section">Códigos para resgatar{pending.length > 0 && <Count n={pending.length} />}</h2>
      <section className="panel compact">
        {data.error && <div className="notice" style={{ marginTop: 0 }}>{data.error}</div>}
        {pending.length ? <ul className="codes">{visible.map(item)}</ul> : (
          <p style={{ margin: 0 }}>Nenhum código novo. Você já resgatou todos os ativos.</p>
        )}
        {pending.length > 2 && (
          <button className="link-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Mostrar menos' : `Ver mais ${pending.length - 2} códigos`}
          </button>
        )}
        <Info label="Como resgatar no PS5">
          <p>
            Toque em <b>Resgatar</b>: abre o site oficial com o código preenchido (e o código fica copiado). Entre com a conta
            HoYoverse, escolha o servidor e confirme. A recompensa chega no correio do jogo. Depois toque no ✓ para marcar.
          </p>
          <p>Lista verificada pela comunidade (hoyo-codes), atualizada de hora em hora.</p>
        </Info>
        {done.length > 0 && (
          <details className="info">
            <summary>Já resgatados ({done.length})</summary>
            <ul className="codes" style={{ marginTop: 10 }}>{done.map(item)}</ul>
          </details>
        )}
      </section>
    </>
  )
}
