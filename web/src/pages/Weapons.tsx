import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { WEAPON_LABEL } from '../../../shared/labels'
import type { WeaponType } from '../../../shared/types'
import type { WeaponRow, WeaponsView } from '../../../shared/view-types'
import { request } from '../api'
import { useApp } from '../App'
import { Count, EmptyAccount, Info, RosterSwitch, hideImg } from '../components'

const TYPES: WeaponType[] = ['sword', 'claymore', 'polearm', 'bow', 'catalyst']

export function Weapons() {
  const { state } = useApp()
  const [data, setData] = useState<WeaponsView>()
  const [error, setError] = useState<string>()
  const [type, setType] = useState<WeaponType>()
  const [showFine, setShowFine] = useState(false)

  useEffect(() => {
    if (state?.view) request<WeaponsView>('GET', 'weapons').then(setData, (e) => setError(e.message))
  }, [state?.view?.fetchedAt])

  const shown = useMemo(() => (data?.weapons ?? []).filter((w) => !type || w.type === type), [data, type])

  if (!state?.view?.characters.length) return <EmptyAccount />
  const moves = shown.filter((w) => !w.ok)
  const fine = shown.filter((w) => w.ok)

  return (
    <>
      <RosterSwitch />
      {error && <div className="notice error">{error}</div>}
      {!data ? <p className="muted">Carregando…</p> : (
        <>
          <Info>
            <p>
              Mostra as armas equipadas nos seus personagens (o app não vê as guardadas no inventário). Quem está nas suas
              melhores equipes escolhe primeiro, e só pega uma arma que aparece no guia dele.
            </p>
            <p>No jogo, ao equipar uma arma que está com outro personagem, os dois trocam.</p>
          </Info>
          <div className="filters" role="group" aria-label="Filtrar por tipo de arma">
            <button className="chip" aria-pressed={!type} onClick={() => setType(undefined)}>Todas ({data.weapons.length})</button>
            {TYPES.map((t) => (
              <button key={t} className="chip" aria-pressed={type === t} onClick={() => setType(t)}>{WEAPON_LABEL[t]}</button>
            ))}
          </div>

          <h2 className="section">Trocar de personagem<Count n={moves.length} /></h2>
          {moves.length ? (
            <div className="weapon-list">{moves.map((w) => <WeaponCard key={w.key} w={w} />)}</div>
          ) : <p className="muted">Nenhuma troca sugerida{type ? ' para esse tipo' : ''}.</p>}

          <h2 className="section">No lugar certo<Count n={fine.length} /></h2>
          {showFine
            ? <div className="weapon-list">{fine.map((w) => <WeaponCard key={w.key} w={w} />)}</div>
            : <button className="btn" onClick={() => setShowFine(true)}>Mostrar as {fine.length} armas</button>}
        </>
      )}
    </>
  )
}

function WeaponCard({ w }: { w: WeaponRow }) {
  return (
    <article className={`weapon-card ${w.ok ? '' : 'move'}`}>
      <div className={`weapon-icon r${w.rarity >= 5 ? 5 : w.rarity === 4 ? 4 : 3}`}>
        {w.icon && <img src={w.icon} alt="" loading="lazy" onError={hideImg} />}
      </div>
      <div className="weapon-body">
        <div className="weapon-name">{w.name}</div>
        <div className="sub">{'★'.repeat(w.rarity)} · Nv. {w.level} · R{w.refinement}{w.type ? ` · ${WEAPON_LABEL[w.type]}` : ''}</div>
        <div className="weapon-who">
          Está com <Link to={`/personagens/${w.holder.id}`}>{w.holder.name}</Link>
          {w.bestFor && (
            <> → deveria estar com <Link to={`/personagens/${w.bestFor.id}`}><b>{w.bestFor.name}</b></Link></>
          )}
        </div>
        {w.bestFor && <div className="sub">{w.bestFor.reason}.</div>}
        {w.recommendedFor.length > 0 && (
          <div className="sub weapon-guides">
            No guia de: {w.recommendedFor.slice(0, 5).map((r) => `${r.name} (${r.rank}ª)`).join(', ')}
          </div>
        )}
      </div>
    </article>
  )
}
