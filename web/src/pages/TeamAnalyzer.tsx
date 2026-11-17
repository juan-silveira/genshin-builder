import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ELEMENT_COLOR } from '../../../shared/labels'
import type { TeamCheckState } from '../../../shared/view-types'
import { request } from '../api'
import { useApp } from '../App'
import { GradeBadge } from '../components'

const VERDICT = {
  funciona: { text: 'Funciona', cls: 'ok' },
  ressalvas: { text: 'Funciona, com ressalvas', cls: 'warn' },
  nao: { text: 'Não funciona bem', cls: 'bad' },
} as const

const ROLE = { principal: 'Atacante principal', sub: 'Sub-DPS', suporte: 'Suporte', desconhecido: 'Sem guia' } as const

/** escolha 4 personagens (ou um time do Abismo) e veja se o time funciona e por quê */
export function TeamAnalyzer() {
  const { state } = useApp()
  const chars = state?.view?.characters ?? []
  const [data, setData] = useState<TeamCheckState>()
  const [picked, setPicked] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => {
    request<TeamCheckState>('GET', 'team-check').then((d) => { setData(d); setPicked(d.saved ?? []) }, (e) => setError(e.message))
  }, [state?.view?.fetchedAt])

  const analyze = (ids: string[]) => {
    setPicked(ids)
    request<TeamCheckState>('POST', 'team-check', { ids }).then((d) => setData((prev) => ({ ...prev, ...d })), (e) => setError(e.message))
  }
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 4 ? [...picked, id] : picked
    analyze(next)
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chars.filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [chars, query])
  const byId = new Map(chars.map((c) => [c.id, c]))
  const check = data?.check
  const abyssTeams = (data?.abyss?.chambers ?? []).flatMap((ch) =>
    ch.halves.map((ids, i) => ({ label: `${ch.floor}-${ch.chamber} · ${i + 1}ª metade (${ch.stars}★)`, ids })),
  )

  return (
    <section className="analyzer">
      <p className="muted" style={{ marginTop: 14 }}>
        Escolha os 4 personagens que você usa e veja se o time funciona, o que está errado e o que trocar.
      </p>

      {data?.abyss && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Abismo atual ({new Date(data.abyss.start).toLocaleDateString('pt-BR')} a {new Date(data.abyss.end).toLocaleDateString('pt-BR')}):{' '}
          {data.abyss.battles ? `${data.abyss.stars}★, até ${data.abyss.maxFloor}.` : 'você ainda não jogou neste ciclo. Quando jogar, os times usados aparecem aqui.'}
        </p>
      )}
      {abyssTeams.length > 0 && (
        <div className="filters" role="group" aria-label="Times usados no Abismo">
          {abyssTeams.map((t) => <button key={t.label} className="chip" onClick={() => analyze(t.ids)}>{t.label}</button>)}
        </div>
      )}

      <div className="picked">
        {[0, 1, 2, 3].map((i) => {
          const c = byId.get(picked[i])
          return c ? (
            <button key={i} className={`pick r${c.rarity}`} onClick={() => toggle(c.id)} title="Tirar do time">
              {c.icon && <img src={c.icon} alt="" />}
              <span>{c.name}</span>
            </button>
          ) : (
            <button key={i} className="pick empty" onClick={() => setPicking(true)}>+</button>
          )
        })}
      </div>
      <button className="btn" onClick={() => setPicking(!picking)} style={{ marginTop: 10 }}>
        {picking ? 'Fechar lista' : picked.length ? 'Trocar personagens' : 'Escolher personagens'}
      </button>

      {picking && (
        <div className="picker">
          <input placeholder="Buscar personagem" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar personagem" />
          <div className="picker-grid">
            {list.map((c) => (
              <button key={c.id} className={`pick small r${c.rarity} ${picked.includes(c.id) ? 'on' : ''}`} onClick={() => toggle(c.id)}>
                {c.icon && <img src={c.icon} alt="" loading="lazy" />}
                <span>{c.name}</span>
                {c.element && <i style={{ background: ELEMENT_COLOR[c.element] }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="notice error">{error}</div>}

      {check && picked.length > 0 && (
        <div className="panel check">
          <div className={`verdict ${VERDICT[check.verdict].cls}`}>{VERDICT[check.verdict].text}</div>
          <div className="check-members">
            {check.members.map((m) => (
              <Link key={m.id} to={`/personagens/${m.id}`}>
                <b>{m.name}</b> · {ROLE[m.role]}{m.grade && <> · <GradeBadge grade={m.grade} /></>}{!m.ready && ' · precisa preparo'}
              </Link>
            ))}
          </div>
          {check.issues.length > 0 && (
            <>
              <h3>Por que {check.verdict === 'funciona' ? 'pode melhorar' : 'não funciona'}</h3>
              <ul className="advice">
                {check.issues.map((i) => <li key={i.text} className={i.level}><span className="dot" /><span>{i.text}</span></li>)}
              </ul>
            </>
          )}
          {check.good.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>O que está bom</h3>
              <ul className="good-list">{check.good.map((g) => <li key={g}>{g}</li>)}</ul>
            </>
          )}
          {check.suggestion && check.suggestion.swaps.length > 0 && (
            <p style={{ margin: '14px 0 0' }}>
              <b>Sugestão:</b> troque {check.suggestion.swaps.map((s) => `${s.out} por ${s.in}${s.owned ? '' : ' (você não tem)'}`).join('; ')} para
              montar a equipe recomendada <b>{check.suggestion.team}</b>.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
