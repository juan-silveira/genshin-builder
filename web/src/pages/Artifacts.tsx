import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SLOT_LABEL, STAT_SHORT, fmtStat } from '../../../shared/labels'
import { SLOTS, type SlotKey } from '../../../shared/types'
import type { ArtifactRow, ArtifactsView } from '../../../shared/view-types'
import { request } from '../api'
import { useApp } from '../App'
import { Count, EmptyAccount, GradeBadge, Info, RosterSwitch, hideImg } from '../components'

export function Artifacts() {
  const { state } = useApp()
  const [data, setData] = useState<ArtifactsView>()
  const [error, setError] = useState<string>()
  const [slot, setSlot] = useState<SlotKey>()
  const [setId, setSetId] = useState<string>()
  const [showAll, setShowAll] = useState(false)
  const [showSets, setShowSets] = useState(false)

  useEffect(() => {
    if (state?.view) request<ArtifactsView>('GET', 'artifacts').then(setData, (e) => setError(e.message))
  }, [state?.view?.fetchedAt])

  const shown = useMemo(
    () => (data?.artifacts ?? []).filter((a) => (!slot || a.slot === slot) && (!setId || a.set.id === setId)),
    [data, slot, setId],
  )

  if (!state?.view?.characters.length) return <EmptyAccount />

  // trocas agrupadas por quem recebe
  const byRecipient = new Map<string, ArtifactRow[]>()
  for (const a of data?.artifacts ?? []) if (a.bestFor) byRecipient.set(a.bestFor.id, [...(byRecipient.get(a.bestFor.id) ?? []), a])

  return (
    <>
      <RosterSwitch />
      {error && <div className="notice error">{error}</div>}
      {!data ? <p className="muted">Carregando…</p> : (
        <>
          <Info>
            <p>
              Mostra os artefatos equipados nos seus personagens (o app não vê os guardados no inventário). Só recebe peças
              quem já está em nível de combate (70+ e arma 60+), e só quando melhora de verdade.
            </p>
            <p>No jogo, ao equipar uma peça que está com outro personagem, os dois trocam.</p>
          </Info>
          <h2 className="section">Trocas que valem a pena<Count n={byRecipient.size} /></h2>
          {byRecipient.size ? (
            <>
              <div className="weapon-list">
                {[...byRecipient.entries()].map(([id, pieces]) => (
                  <section key={id} className="panel" style={{ margin: 0 }}>
                    <div className="opt-head">
                      <Link to={`/personagens/${id}`}><b>{pieces[0].bestFor!.name}</b></Link>
                      <span className="row" style={{ gap: 6 }}>
                        <GradeBadge grade={pieces[0].bestFor!.from} /> → <GradeBadge grade={pieces[0].bestFor!.to} />
                        <span className="sub" style={{ fontSize: '0.8rem' }}>{pieces[0].bestFor!.fromPct}% → {pieces[0].bestFor!.toPct}%</span>
                      </span>
                    </div>
                    <ul className="move-list">
                      {pieces.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)).map((a) => (
                        <li key={a.key}>
                          <b>{a.slotName}</b>: {a.set.name}, {STAT_SHORT[a.mainStat]} +{a.level} — está com {a.holder.name}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          ) : <p className="muted">Nenhuma troca que melhore bastante algum personagem.</p>}

          <h2 className="section">Seus sets</h2>
          <div className="set-list">
            {data.sets.filter((s) => s.pieces > 0 || s.recommendedFor.length >= 2).slice(0, showSets ? undefined : 6).map((s) => (
              <button key={s.id} className={`set-row ${setId === s.id ? 'active' : ''}`} onClick={() => setSetId(setId === s.id ? undefined : s.id)}>
                {s.icon && <img src={s.icon} alt="" loading="lazy" onError={hideImg} />}
                <span>
                  <b>{s.name}</b> · {s.pieces} {s.pieces === 1 ? 'peça' : 'peças'}
                  {s.recommendedFor.length > 0 && <span className="sub"> · no guia de {s.recommendedFor.length}</span>}
                  {s.where && <span className="sub block">{s.where}</span>}
                </span>
              </button>
            ))}
          </div>

          {!showSets && data.sets.filter((s) => s.pieces > 0 || s.recommendedFor.length >= 2).length > 6 && (
            <button className="btn" style={{ marginTop: 10 }} onClick={() => setShowSets(true)}>Mostrar todos os sets</button>
          )}

          <h2 className="section">Todas as peças<Count n={shown.length} /></h2>
          <div className="filters" role="group" aria-label="Filtrar por peça">
            <button className="chip" aria-pressed={!slot} onClick={() => setSlot(undefined)}>Todas</button>
            {SLOTS.map((s) => <button key={s} className="chip" aria-pressed={slot === s} onClick={() => setSlot(s)}>{SLOT_LABEL[s]}</button>)}
            {setId && <button className="chip" aria-pressed onClick={() => setSetId(undefined)}>Set: {data.sets.find((x) => x.id === setId)?.name} ✕</button>}
          </div>
          {!showAll && !slot && !setId ? (
            <button className="btn" style={{ marginTop: 6 }} onClick={() => setShowAll(true)}>Mostrar as {shown.length} peças</button>
          ) : (
          <div className="artifacts" style={{ marginTop: 12 }}>
            {shown.map((a) => (
              <article key={a.key} className={`artifact r${a.rarity} ${a.ok ? '' : 'move'}`}>
                <header>
                  {a.set.icon && <img src={a.set.icon} alt="" loading="lazy" onError={hideImg} />}
                  <div>
                    <div className="slotname">{a.slotName} +{a.level}</div>
                    <div className={`main ${a.mainStatOk === false ? 'bad' : ''}`}>{STAT_SHORT[a.mainStat]} {fmtStat(a.mainStat, a.mainValue)}</div>
                  </div>
                  {a.grade && <GradeBadge grade={a.grade} title={`Nota para ${a.holder.name}`} />}
                </header>
                <ul>
                  {a.substats.map((s) => (
                    <li key={s.key}><span>{STAT_SHORT[s.key]}</span><span>{fmtStat(s.key, s.value)}</span></li>
                  ))}
                </ul>
                <div className="sub" style={{ fontSize: '0.78rem', marginTop: 6 }}>{a.set.name}</div>
                <div style={{ fontSize: '0.84rem', marginTop: 4 }}>
                  Com <Link to={`/personagens/${a.holder.id}`}>{a.holder.name}</Link>
                  {a.bestFor && <> → <Link to={`/personagens/${a.bestFor.id}`}><b>{a.bestFor.name}</b></Link></>}
                </div>
              </article>
            ))}
          </div>
          )}
        </>
      )}
    </>
  )
}
