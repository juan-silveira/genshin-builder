import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CONTROL_LEGEND, CONTROL_LABEL, adaptControls } from '../../../shared/controls'
import type { OptimizeResult, TeamView } from '../../../shared/view-types'
import { optimize } from '../api'
import { useApp } from '../App'
import { CharCard, Count, EmptyAccount, Info, Segmented, memberLink, teamSlug } from '../components'
import { TeamAnalyzer } from './TeamAnalyzer'

type View = 'sugestoes' | 'analisar'
type Filter = 'pronta' | 'preparar' | 'falta'

export function Teams() {
  const { state } = useApp()
  const { hash } = useLocation()
  const view = state?.view
  const target = decodeURIComponent(hash.slice(1))
  const targetTeam = view?.teams.find((t) => teamSlug(t.name) === target)
  const ready = view?.teams.filter((t) => t.status === 'pronta') ?? []
  // as que dependem de menos gente para ficar prontas vêm primeiro
  const notReady = (t: TeamView) => t.members.filter((m) => !m.readiness?.ready).length
  const prepare = (view?.teams.filter((t) => t.status === 'preparar') ?? []).sort((a, b) => notReady(a) - notReady(b) || b.score - a.score)
  const almost = view?.teams.filter((t) => t.status === 'falta') ?? []

  const [mode, setMode] = useState<View>('sugestoes')
  // abre na lista da equipe de onde a pessoa voltou; senão na primeira lista que tem algo
  const [filter, setFilter] = useState<Filter>(
    () => targetTeam?.status ?? (ready.length ? 'pronta' : prepare.length ? 'preparar' : 'falta'),
  )

  useEffect(() => {
    if (target) document.getElementById(`equipe-${target}`)?.scrollIntoView({ block: 'start' })
  }, [target])
  if (!view?.characters.length) return <EmptyAccount />

  const pair = view.abyssPair
  const pairReady = pair && view.teams[pair[0]].status === 'pronta' && view.teams[pair[1]].status === 'pronta'
  const lists: Record<Filter, TeamView[]> = { pronta: ready, preparar: prepare, falta: almost }
  const shown = lists[filter]

  return (
    <>
      <Segmented<View>
        label="Equipes"
        value={mode}
        onChange={setMode}
        options={[{ value: 'sugestoes', label: 'Equipes sugeridas' }, { value: 'analisar', label: 'Analisar meu time' }]}
      />

      {mode === 'analisar' ? <TeamAnalyzer /> : (
        <>
          {pair && (
            <section className="pair-card">
              <div className="pair-head">
                <h2>Dupla para o Abismo</h2>
                <span className={`pill ${pairReady ? 'ok' : 'warn'}`}>{pairReady ? '✓ Prontas' : '! Preparar'}</span>
              </div>
              <p className="muted">
                {pairReady
                  ? 'As duas melhores equipes prontas, sem repetir personagem.'
                  : 'Ainda não há duas equipes prontas sem repetir personagem. Estas são as mais perto.'}
              </p>
              {[pair[0], pair[1]].map((i, half) => {
                const t = view.teams[i]
                return (
                  <a key={t.name} className="pair-row" href={`#${teamSlug(t.name)}`}
                    onClick={(e) => { e.preventDefault(); setFilter(t.status); setTimeout(() => document.getElementById(`equipe-${teamSlug(t.name)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50) }}>
                    <span className="half">{half + 1}ª metade</span>
                    <span className="pair-name">{t.name}</span>
                    <span className="pair-avatars">
                      {t.members.map((m) => (
                        <span key={m.id} className={`mini r${m.rarity} ${m.readiness?.ready ? '' : 'prep'}`}>{m.icon && <img src={m.icon} alt={m.name} />}</span>
                      ))}
                    </span>
                  </a>
                )
              })}
              <Optimizer teams={[view.teams[pair[0]].name, view.teams[pair[1]].name]} label="Otimizar as duas juntas" />
            </section>
          )}

          <div className="sticky-tabs">
            <Segmented<Filter>
              label="Situação das equipes"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pronta', label: <>Prontas<Count n={ready.length} /></> },
                { value: 'preparar', label: <>Preparar<Count n={prepare.length} /></> },
                { value: 'falta', label: <>Falta alguém<Count n={almost.length} /></> },
              ]}
            />
          </div>
          <Info label="O que é cada lista?">
            <p><b>Prontas:</b> você tem os 4 e todos estão em condição de lutar (nível 70+, pelo menos 3 artefatos e arma 60+).</p>
            <p><b>Preparar:</b> você tem os 4, mas alguém precisa subir nível, arma ou artefatos. As que precisam de menos preparo vêm primeiro.</p>
            <p><b>Falta alguém:</b> falta 1 personagem que você não tem.</p>
          </Info>

          {shown.length ? shown.map((t) => <TeamCard key={t.name} t={t} />) : (
            <p className="muted">
              {filter === 'pronta'
                ? 'Nenhuma equipe com os 4 membros prontos ainda. Veja a lista "Preparar": cada membro marcado mostra o que falta.'
                : 'Nenhuma equipe nesta lista.'}
            </p>
          )}
        </>
      )}
    </>
  )
}

const REPLACE_REASON = {
  'nao-tem': '(você não tem)',
  'nao-pronto': '(precisa de preparo)',
  'em-uso': '(já está no time)',
} as const

function TeamCard({ t }: { t: TeamView }) {
  const { controls } = useApp()
  return (
    <article className="team" id={`equipe-${teamSlug(t.name)}`}>
      <header>
        <h3>{t.name}</h3>
        <span className="team-power" title="Força média do time (0–100)">Força {t.power}</span>
      </header>
      <div className="tags">{t.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div className="members">
        {t.members.map((m) => (
          <div key={m.id}>
            <CharCard
              id={m.id}
              name={m.name}
              icon={m.icon}
              rarity={m.rarity}
              element={m.element}
              grade={m.buildGrade}
              link={m.owned}
              to={memberLink(m.id, t.name)}
              className={!m.owned ? 'missing' : m.readiness?.ready ? 'is-ready' : 'needs-prep'}
            />
            <div className={`member-status ${!m.owned ? 'falta' : m.readiness?.ready ? 'ok' : 'prep'}`}>
              {!m.owned ? 'não tem' : m.readiness?.ready ? '✓ pronto' : '! preparar'}
            </div>
          </div>
        ))}
      </div>
      <TeamChecklist t={t} />

      <details className="rotation">
        <summary>Como jogar (rotação e dicas)</summary>
        {t.notes && (
          <p className="guide-note">
            <b>Dica do guia</b> (escrita para a versão ideal desta equipe; pode citar personagens que não estão no seu time):{' '}
            {adaptControls(t.notes, controls)}
          </p>
        )}
        <ol>{t.rotation.map((s, i) => <li key={i}>{adaptControls(s, controls)}</li>)}</ol>
        <div className="legend" aria-label={`Botões (${CONTROL_LABEL[controls]})`}>
          {CONTROL_LEGEND[controls].map((l) => <span key={l}>{l}</span>)}
        </div>
        {t.members.some((m) => m.alternatives.length > 0) && (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Alternativas: {t.members.filter((m) => m.alternatives.length).map((m) => `${m.name} → ${m.alternatives.join(', ')}`).join(' · ')}
          </p>
        )}
      </details>
      {t.status !== 'falta' && <Optimizer teams={[t.name]} label="Otimizar artefatos e armas" />}
    </article>
  )
}

/** sugere trocas de artefatos/armas entre personagens para deixar o(s) time(s) melhor(es) */
function Optimizer({ teams, label }: { teams: string[]; label: string }) {
  const [result, setResult] = useState<OptimizeResult>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(undefined)
    try { setResult(await optimize(teams)) } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!result) {
    return (
      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Calculando…' : label}</button>
        {error && <div className="notice error">{error}</div>}
      </div>
    )
  }

  const nothing = !result.artifactMoves.length && !result.weaponMoves.length
  const recipients = [...new Set([...result.artifactMoves.map((m) => m.to), ...result.weaponMoves.map((m) => m.to)])]
  return (
    <section className="optimizer">
      <h4>Trocas sugeridas</h4>
      {nothing ? <p>Nada a trocar: com o que está equipado na conta, este time já está na melhor distribuição.</p> : (
        <>
          <p className="sub" style={{ fontSize: '0.85rem', marginTop: 0 }}>
            No jogo, ao equipar uma peça que está em outro personagem, os dois trocam. Comece pelo primeiro da lista.
          </p>
          {recipients.map((id) => {
            const m = result.members.find((x) => x.id === id)!
            const lostSet = m.before.set && !m.after.set
            return (
              <div key={id} className="opt-member">
                <div className="opt-head">
                  <b>{m.name}</b>
                  <span>{m.before.grade} {m.before.pct}% → <b>{m.after.grade} {m.after.pct}%</b></span>
                </div>
                <ul>
                  {result.weaponMoves.filter((w) => w.to === id).map((w) => (
                    <li key={w.weapon}>Arma: <b>{w.weapon}</b> (nv. {w.level}, R{w.refinement}) — está com {w.fromName}{w.fromInTeam ? ' (do time)' : ''}</li>
                  ))}
                  {result.artifactMoves.filter((a) => a.to === id).map((a) => (
                    <li key={a.slot}>{a.slotName}: {a.setName}, {a.mainStat} +{a.level} — está com {a.fromName}{a.fromInTeam ? ' (do time)' : ''}</li>
                  ))}
                </ul>
                {m.after.set && m.after.set !== m.before.set && <div className="sub">Bônus de set ativo depois: {m.after.set}</div>}
                {lostSet && <div className="sub warn">Perde o bônus {m.before.set}; as peças avulsas compensam pelos atributos.</div>}
              </div>
            )
          })}
        </>
      )}
      <button className="btn" onClick={() => setResult(undefined)} style={{ marginTop: 8 }}>Fechar</button>
    </section>
  )
}

/** o que falta para cada membro: bloqueios primeiro, avisos depois */
function TeamChecklist({ t }: { t: TeamView }) {
  const missing = t.members.filter((m) => !m.owned)
  const blocked = t.members.filter((m) => m.owned && m.readiness && !m.readiness.ready)
  const warned = t.members.filter((m) => m.owned && m.readiness?.ready && m.readiness.warnings.length)
  const subs = t.members.filter((m) => m.owned && m.replaces)
  if (!missing.length && !blocked.length && !warned.length && !subs.length) return null
  return (
    <div className="checklist">
      {subs.length > 0 && (
        <div className="sub-line">
          {subs.map((m) => `${m.name} está no lugar de ${m.replaces!.name} ${REPLACE_REASON[m.replaces!.reason]}`).join(' · ')}
        </div>
      )}
      {missing.map((m) => (
        <div key={m.id} className="falta"><b>{m.name}:</b> você não tem{m.alternatives.length ? ` (alternativas: ${m.alternatives.join(', ')})` : ''}</div>
      ))}
      {blocked.map((m) => (
        <div key={m.id} className="prep"><b>{m.name}:</b> {[...m.readiness!.blocking, ...m.readiness!.warnings].join(' · ')}</div>
      ))}
      {warned.length > 0 && (
        <div className="warn-line">
          Pode melhorar: {warned.map((m) => `${m.name} (${m.readiness!.warnings.join(', ')})`).join('; ')}
        </div>
      )}
    </div>
  )
}
