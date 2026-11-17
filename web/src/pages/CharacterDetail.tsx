import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TALENT_BUTTON, adaptControls } from '../../../shared/controls'
import { SLOT_LABEL, STAT_LABEL, STAT_SHORT, TALENT_LABEL, WEAPON_LABEL, fmtStat } from '../../../shared/labels'
import { SLOTS, type SlotKey, type StatKey } from '../../../shared/types'
import type { ArtifactView, CharacterView, FarmMaterial, FarmPlan, MaterialCategory, RoleView, TeamView, Tip } from '../../../shared/view-types'
import { useApp } from '../App'
import { CharCard, Count, GradeBadge, Info, Segmented, memberLink, teamSlug } from '../components'
import { DOMAIN_HINT, MapLink, hideImg } from '../components'

const SHOWN_STATS: StatKey[] = ['hp', 'atk', 'def', 'eleMas', 'critRate_', 'critDMG_', 'enerRech_']

type Tab = 'resumo' | 'artefatos' | 'guia' | 'farm'

export function CharacterDetail() {
  const { id } = useParams()
  const { state } = useApp()
  const c = state?.view?.characters.find((x) => x.id === id)
  const [roleIdx, setRoleIdx] = useState<number>()
  const [tab, setTab] = useState<Tab>('resumo')
  const [params] = useSearchParams()
  const team = state?.view?.teams.find((t) => t.name === params.get('equipe'))

  // ao trocar de personagem: volta ao topo, à primeira aba e ao papel que combina com a build
  useEffect(() => {
    window.scrollTo(0, 0)
    setRoleIdx(undefined)
    setTab('resumo')
  }, [id])

  if (!c) return <p>Personagem não encontrado. <Link to="/personagens" className="back">Voltar</Link></p>

  const ri = roleIdx ?? c.bestRole
  const role = c.roles[ri]
  const dmgBonus = (Object.entries(c.stats) as [StatKey, number][])
    .filter(([k, v]) => k.endsWith('_dmg_') && v > 0)
    .sort((a, b) => b[1] - a[1])[0]
  const hasFarm = !!c.farm && c.farm.goals.length > 0

  const roleChips = c.roles.length > 1 && (
    <div className="filters" role="group" aria-label="Papel do personagem">
      {c.roles.map((r, i) => (
        <button key={r.name} className="chip" aria-pressed={i === ri} onClick={() => setRoleIdx(i)}>
          {r.name}{i === c.bestRole ? ' · atual' : ''}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {team ? <TeamStrip team={team} currentId={c.id} /> : <Link to="/personagens" className="back">‹ Personagens</Link>}
      <div className="hero">
        <CharCard id={c.id} name={`Nv. ${c.level}`} icon={c.icon} rarity={c.rarity} element={c.element} constellation={c.constellation} link={false} />
        <div>
          <h2>{c.name}</h2>
          <div className="facts">
            {c.element} · {c.weaponType && WEAPON_LABEL[c.weaponType]} · C{c.constellation}
            {c.talents && ` · Talentos ${c.talents.auto}/${c.talents.skill}/${c.talents.burst}`}
          </div>
          <div className="hero-pills">
            <span className={`pill ${c.readiness.ready ? 'ok' : 'warn'}`}>{c.readiness.ready ? '✓ Pronto' : '! Preparar'}</span>
            <span className="pill" title="Força estimada: artefatos, nível, talentos, arma e constelação">Força <b>{c.power}</b></span>
            {role && c.artifacts.length > 0 && <span className="pill"><GradeBadge grade={role.grade} /> {role.buildPct}%</span>}
          </div>
        </div>
      </div>
      {!c.readiness.ready && <p className="prep-line">Para usar em combate: {c.readiness.blocking.join(' · ')}.</p>}

      {c.guideConfidence && c.guideConfidence !== 'alta' && (
        <div className="notice">
          {c.guideConfidence === 'baixa'
            ? 'Personagem muito recente: este guia se baseia em poucas fontes e pode mudar. Confira com um guia atualizado antes de gastar recursos raros.'
            : 'Personagem recente: armas e sets são consenso da comunidade, mas a ordem de talentos e a meta de Recarga são aproximadas.'}
        </div>
      )}

      <div className="sticky-tabs">
        <Segmented<Tab>
          label="Seções do personagem"
          value={tab}
          onChange={(t) => { setTab(t); window.scrollTo({ top: 0 }) }}
          options={[
            { value: 'resumo', label: 'Resumo' },
            { value: 'artefatos', label: <>Artefatos<Count n={c.artifacts.length} /></> },
            { value: 'guia', label: 'Guia' },
            ...(hasFarm ? [{ value: 'farm' as Tab, label: 'Farm' }] : []),
          ]}
        />
      </div>

      {tab === 'resumo' && (
        <>
          {roleChips}
          {role && <IdealSummary role={role} onOpen={() => { setTab('artefatos'); window.scrollTo({ top: 0 }) }} />}
          <section className="panel">
            <h3>O que melhorar</h3>
            <TipList tips={role ? role.advice : c.genericAdvice} empty="Build alinhada com o guia. Agora é caçar substatus melhores." />
          </section>
          {role && role.upgradePlan.length > 0 && <UpgradePlan role={role} />}
          <section className="panel">
            <h3>Atributos e equipamento</h3>
            <div className="stat-grid">
              {SHOWN_STATS.filter((k) => c.stats[k] !== undefined).map((k) => (
                <div key={k}><span>{STAT_SHORT[k]}</span><b>{fmtStat(k, c.stats[k]!)}</b></div>
              ))}
              {dmgBonus && <div><span>{STAT_SHORT[dmgBonus[0]]}</span><b>{fmtStat(dmgBonus[0], dmgBonus[1])}</b></div>}
            </div>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Arma</dt>
              <dd>{c.weapon ? `${c.weapon.name} · Nv. ${c.weapon.level} · R${c.weapon.refinement}` : '—'}</dd>
              <dt>Sets</dt>
              <dd>{c.setCounts.length ? c.setCounts.map((s) => `${s.name} (${s.count})`).join(', ') : '—'}</dd>
            </dl>
            {c.powerNotes.length > 0 && <p className="sub" style={{ margin: '10px 0 0', fontSize: '0.84rem' }}>O que puxa a força para baixo: {c.powerNotes.join(' · ')}.</p>}
          </section>
        </>
      )}

      {tab === 'artefatos' && (
        <>
          {roleChips}
          {role ? <IdealArtifacts role={role} c={c} /> : (
            <section className="panel">
              <h3>Artefatos ideais</h3>
              <p style={{ margin: 0 }}>
                Ainda não há guia para este personagem. Em geral: 4 peças do mesmo set, Relógio/Cálice/Tiara com o atributo que
                ele usa para causar dano (ATQ%, Vida% ou DEF%, Dano Elemental, Crítico) e substatus de Taxa e Dano Crítico.
              </p>
            </section>
          )}
          <h2 className="section">Equipados hoje{c.artifacts.length > 0 && <Count n={c.artifacts.length} />}</h2>
          {c.artifacts.length ? (
            <>
              <GradeExplainer />
              <div className="artifacts">
                {c.artifacts.map((a) => <ArtifactCard key={a.slot} a={a} />)}
              </div>
            </>
          ) : (
            <section className="panel compact"><p style={{ margin: 0 }}>Nenhum artefato equipado.</p></section>
          )}
        </>
      )}

      {tab === 'guia' && (
        role ? <>{roleChips}<RoleGuide role={role} c={c} /></> : (
          <section className="panel">
            <h3>Guia</h3>
            <p style={{ marginTop: 0 }}>Ainda não há guia curado para este personagem.</p>
            <TipList tips={c.genericAdvice} empty="" />
          </section>
        )
      )}

      {tab === 'farm' && hasFarm && <FarmSection farm={c.farm!} />}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (<><dt>{label}</dt><dd>{value}</dd></>)
}

function TipList({ tips, empty }: { tips: Tip[]; empty: string }) {
  if (!tips.length) return <p className="sub" style={{ margin: 0 }}>{empty}</p>
  return (
    <ul className="advice">
      {tips.map((t) => (
        <li key={t.text} className={t.level}>
          <span className="dot" title={`Prioridade ${t.level}`} />
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  )
}

function ArtifactCard({ a }: { a: ArtifactView }) {
  return (
    <article className={`artifact r${a.rarity}`}>
      <header>
        {a.icon && <img src={a.icon} alt="" loading="lazy" />}
        <div>
          <div className="slotname">{SLOT_LABEL[a.slot]} +{a.level}</div>
          <div className={`main ${a.mainStatOk === false ? 'bad' : ''}`}>
            {STAT_SHORT[a.mainStat]} {fmtStat(a.mainStat, a.mainValue)}
            {a.mainStatOk === false && ' (errado)'}
          </div>
        </div>
        <GradeBadge grade={a.grade} title={`Nota do app: ${a.grade} — ${a.score} de ~7 subidas foram para atributos úteis`} />
      </header>
      <ul>
        {a.substats.map((s) => (
          <li key={s.key} className={s.weight >= 0.75 ? 'useful' : s.weight === 0 ? 'useless' : ''}>
            <span>{STAT_SHORT[s.key]}</span>
            <span>{fmtStat(s.key, s.value)}</span>
          </li>
        ))}
      </ul>
      <div className="sub" style={{ fontSize: '0.78rem', marginTop: 6 }}>{a.set.name}</div>
    </article>
  )
}

function RoleGuide({ role, c }: { role: RoleView; c: CharacterView }) {
  const { controls } = useApp()
  return (
    <>
      <h2 className="section">{role.name}</h2>
      {role.tips && <section className="panel"><p style={{ margin: 0 }}>{adaptControls(role.tips, controls)}</p></section>}
      <div className="grid2">
        <section className="panel">
          <h3>Armas recomendadas</h3>
          <ul className="rec-list">
            {role.weapons.map((w) => (
              <li key={w.id} className={`r${w.rarity ?? 4} ${w.id === c.weapon?.id ? 'current' : ''}`}>
                {w.icon && <img src={w.icon} alt="" loading="lazy" />}
                <div>
                  <div className="name">{w.name}</div>
                  {w.note && <div className="note">{w.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h3>Talentos</h3>
          <p style={{ margin: 0 }}>
            <span className="sub">Prioridade: </span>
            <b>{role.talentPriority.map((t) => `${TALENT_LABEL[t]} (${TALENT_BUTTON[controls][t]})`).join(' › ')}</b>
          </p>
          {c.talents && (
            <p className="sub" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
              Hoje: Ataque Normal {c.talents.auto} · Habilidade {c.talents.skill} · Supremo {c.talents.burst}
            </p>
          )}
          <p className="sub" style={{ margin: '10px 0 0', fontSize: '0.86rem' }}>Os artefatos ideais estão na aba <b>Artefatos</b>.</p>
        </section>
      </div>
    </>
  )
}

/** ordem de prioridade dos substatus: "Taxa Crítica = Dano Crítico > Recarga > ATQ%" */
function substatPriority(role: RoleView) {
  const list = (Object.entries(role.substats) as [StatKey, number][])
    .filter(([k, w]) => w >= 0.3 && !['hp', 'atk', 'def'].includes(k))
    .sort((a, b) => b[1] - a[1])
  let out = ''
  list.forEach(([k, w], i) => {
    if (i > 0) out += Math.abs(list[i - 1][1] - w) < 0.05 ? ' = ' : ' > '
    out += STAT_LABEL[k]
  })
  return out
}

/** número da imagem de cada peça no Enka (UI_RelicIcon_<set>_<n>) */
const PIECE_ICON_N: Record<SlotKey, number> = { flower: 4, plume: 2, sands: 5, goblet: 1, circlet: 3 }
const pieceIcon = (setId: string | undefined, slot: SlotKey) =>
  setId ? `https://enka.network/ui/UI_RelicIcon_${setId}_${PIECE_ICON_N[slot]}.png` : undefined
const FIXED_MAIN: Partial<Record<SlotKey, StatKey>> = { flower: 'hp', plume: 'atk' }

/** uma linha no Resumo com o build ideal; toque leva à aba Artefatos */
function IdealSummary({ role, onOpen }: { role: RoleView; onOpen: () => void }) {
  const best = role.artifactSets[0]
  if (!best) return null
  const active = role.artifactSets.some((o) => o.matched)
  return (
    <button className="panel ideal-summary" onClick={onOpen}>
      {pieceIcon(best.sets[0]?.id, 'flower') && <img src={pieceIcon(best.sets[0]?.id, 'flower')} alt="" onError={hideImg} />}
      <span>
        <span className="sub">Artefatos ideais {active ? '· ✓ set ativo' : ''}</span>
        <b>{best.sets.map((x) => `${x.pieces}× ${x.name}`).join(' + ')}</b>
        <span className="sub">
          Relógio {role.mainStats.sands.map((k) => STAT_SHORT[k]).join('/')} · Cálice {role.mainStats.goblet.map((k) => STAT_SHORT[k]).join('/')} ·
          Tiara {role.mainStats.circlet.map((k) => STAT_SHORT[k]).join('/')}
        </span>
      </span>
      <span className="chev" aria-hidden="true">›</span>
    </button>
  )
}

/** o build ideal de artefatos, comparado peça por peça com o que está equipado */
function IdealArtifacts({ role, c }: { role: RoleView; c: CharacterView }) {
  const best = role.artifactSets[0]
  const matchedIdx = role.artifactSets.findIndex((o) => o.matched)
  const bestIds = new Set(best?.sets.map((x) => x.id))
  const er = c.stats.enerRech_
  const erOk = role.erMin === undefined || er === undefined || er >= role.erMin - 0.5

  return (
    <section className="panel ideal">
      <h3>Artefatos ideais para {c.name}</h3>

      {best && (
        <div className="ideal-set">
          <div className="ideal-set-icons">
            {best.sets.map((x) => <img key={x.id} src={pieceIcon(x.id, 'flower')} alt="" onError={hideImg} />)}
          </div>
          <div>
            <b>{best.sets.map((x) => `${x.pieces}× ${x.name}`).join(' + ')}</b>
            {best.note && <div className="sub">{best.note}</div>}
            <div className={`set-status ${matchedIdx === 0 ? 'ok' : matchedIdx > 0 ? 'meh' : 'bad'}`}>
              {matchedIdx === 0 ? '✓ Você já usa este set'
                : matchedIdx > 0 ? `Você usa uma alternativa: ${role.artifactSets[matchedIdx].sets.map((x) => `${x.pieces}× ${x.name}`).join(' + ')}`
                : `Hoje: ${c.setCounts.length ? c.setCounts.map((x) => `${x.count}× ${x.name}`).join(', ') : 'nenhum set'}`}
            </div>
            {[...new Set(best.sets.map((x) => x.where).filter(Boolean))].map((w) => <div key={w} className="sub">Onde farmar: {w}</div>)}
            {best.sets.length === 1 && best.sets[0].pieces === 4 && (
              <div className="sub">4 peças do set ativam o bônus; a 5ª pode ser de qualquer set (escolha a de melhor atributo).</div>
            )}
          </div>
        </div>
      )}

      <ul className="ideal-slots">
        {SLOTS.map((slot) => {
          const cur = c.artifacts.find((a) => a.slot === slot)
          const ideal = FIXED_MAIN[slot] ? [FIXED_MAIN[slot]!] : role.mainStats[slot as 'sands' | 'goblet' | 'circlet']
          const mainOk = cur ? (FIXED_MAIN[slot] ? true : cur.mainStatOk !== false) : false
          return (
            <li key={slot}>
              <img className="ideal-icon" src={pieceIcon(best?.sets[0]?.id, slot)} alt="" onError={hideImg} />
              <div className="ideal-text">
                <div className="ideal-slot">{SLOT_LABEL[slot]}</div>
                <div><span className="sub">Ideal: </span><b>{ideal.map((k) => STAT_LABEL[k]).join(' ou ')}</b>{FIXED_MAIN[slot] && <span className="sub"> (sempre)</span>}</div>
                <div className={`ideal-now ${!cur ? 'bad' : mainOk ? 'ok' : 'bad'}`}>
                  {!cur ? '✗ Nenhuma peça equipada'
                    : <>{mainOk ? '✓' : '✗'} Hoje: {STAT_SHORT[cur.mainStat]}{!mainOk && ' (errado)'} · <span className={bestIds.has(cur.set.id) ? 'in-set' : ''}>{cur.set.name}</span></>}
                </div>
              </div>
              {cur && (
                <div className="ideal-cur">
                  {cur.icon && <img src={cur.icon} alt="" onError={hideImg} />}
                  <GradeBadge grade={cur.grade} title={`Nota da peça atual: ${cur.grade}`} />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <dl className="kv ideal-kv">
        <dt>Substatus</dt>
        <dd>{substatPriority(role)}</dd>
        {role.erTarget && (
          <>
            <dt>Recarga</dt>
            <dd>
              {role.erTarget}
              {er !== undefined && <span className={erOk ? 'ok-text' : 'bad-text'}> · hoje {er.toFixed(0)}% {erOk ? '✓' : '✗'}</span>}
            </dd>
          </>
        )}
      </dl>

      {role.artifactSets.length > 1 && (
        <details className="info">
          <summary>Outras opções de set ({role.artifactSets.length - 1})</summary>
          <ul className="alt-sets">
            {role.artifactSets.slice(1).map((o, i) => (
              <li key={i} className={o.matched ? 'matched' : ''}>
                <b>{o.sets.map((x) => `${x.pieces}× ${x.name}`).join(' + ')}</b>{o.matched && ' · ✓ você usa'}
                {o.note && <div className="sub">{o.note}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/** faixa com os membros da equipe de onde a pessoa veio, para pular entre eles */
function TeamStrip({ team, currentId }: { team: TeamView; currentId: string }) {
  const navigate = useNavigate()
  const owned = team.members.filter((m) => m.owned)
  const idx = owned.findIndex((m) => m.id === currentId)
  const prev = idx > 0 ? owned[idx - 1] : undefined
  const next = idx >= 0 && idx < owned.length - 1 ? owned[idx + 1] : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft' && prev) navigate(memberLink(prev.id, team.name))
      if (e.key === 'ArrowRight' && next) navigate(memberLink(next.id, team.name))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, team.name, navigate])

  return (
    <nav className="team-strip" aria-label={`Equipe ${team.name}`}>
      <Link to={`/equipes#${teamSlug(team.name)}`} className="back">‹ {team.name}</Link>
      <div className="strip-row">
        <Arrow to={prev && memberLink(prev.id, team.name)} label={prev ? `Anterior: ${prev.name}` : 'Sem anterior'}>‹</Arrow>
        <ol>
          {team.members.map((m) => {
            const body = (
              <>
                {m.icon && <img src={m.icon} alt="" />}
                <span>{m.name}</span>
              </>
            )
            return (
              <li key={m.id} className={`${m.id === currentId ? 'current' : ''} ${m.owned ? '' : 'missing'} r${m.rarity}`}>
                {m.owned && m.id !== currentId
                  ? <Link to={memberLink(m.id, team.name)}>{body}</Link>
                  : <div aria-current={m.id === currentId ? 'page' : undefined}>{body}</div>}
              </li>
            )
          })}
        </ol>
        <Arrow to={next && memberLink(next.id, team.name)} label={next ? `Próximo: ${next.name}` : 'Sem próximo'}>›</Arrow>
      </div>
    </nav>
  )
}

function Arrow({ to, label, children }: { to?: string; label: string; children: string }) {
  return to
    ? <Link to={to} className="strip-arrow" aria-label={label} title={label}>{children}</Link>
    : <span className="strip-arrow disabled" aria-hidden="true">{children}</span>
}

const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  dominio: 'Domínios (dias certos)',
  semanal: 'Chefe semanal',
  chefe: 'Chefe de mundo',
  gema: 'Gemas (chefes de mundo)',
  especialidade: 'Especialidade local',
  comum: 'Inimigos comuns',
  outro: 'Outros',
}

function FarmSection({ farm }: { farm: FarmPlan }) {
  const groups = new Map<MaterialCategory, FarmMaterial[]>()
  for (const m of farm.materials) groups.set(m.category, [...(groups.get(m.category) ?? []), m])
  return (
    <>

      <section className="panel">
        <h3>Metas</h3>
        <ul className="goals">{farm.goals.map((g) => <li key={g}>{g}</li>)}</ul>
        <p className="sub" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
          Total: {farm.mora.toLocaleString('pt-BR')} Mora além dos materiais abaixo.
        </p>
      </section>
      {[...groups.entries()].map(([cat, mats]) => (
        <section key={cat} className="panel">
          <h3>{CATEGORY_LABEL[cat]}</h3>
          {cat === 'dominio' && <p className="sub" style={{ fontSize: '0.85rem', marginTop: -4 }}>{DOMAIN_HINT}</p>}
          <ul className="farm-list">
            {mats.map((m) => (
              <li key={m.id}>
                {m.icon && <img src={m.icon} alt="" loading="lazy" onError={hideImg} />}
                <div>
                  <div><b>{m.count}×</b> {m.name}</div>
                  <div className="sub" style={{ fontSize: '0.85rem' }}>{m.where}</div>
                  {m.mapUrl && <MapLink url={m.mapUrl} />}
                  {m.days && (
                    <div className={`days ${m.availableToday ? 'today' : ''}`}>
                      {m.availableToday ? 'Disponível hoje' : m.days.filter((d) => d !== 'Domingo').join(', ') + ' e domingo'}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/** passos em ordem de impacto para subir a nota dos artefatos */
function UpgradePlan({ role }: { role: RoleView }) {
  const last = role.upgradePlan[role.upgradePlan.length - 1]
  const lookFor = role.upgradePlan.find((s) => s.lookFor)?.lookFor
  return (
    <section className="panel">
      <h3>Como subir a nota</h3>
      <p className="sub" style={{ marginTop: -4, fontSize: '0.88rem' }}>
        Hoje: <b>{role.grade} ({role.buildPct}%)</b>. Seguindo os passos chega a <b>{last.resultGrade} ({last.resultPct}%)</b>.
        Valores estimados: artefato novo depende da sorte.
        {lookFor && <> Nas peças novas, procure <b>{lookFor.replace('substatus de ', '')}</b> nos substatus.</>}
      </p>
      <ol className="plan">
        {role.upgradePlan.map((s) => (
          <li key={s.text}>
            <div>{s.text}</div>
            <div className="plan-gain">+{s.gain} → <GradeBadge grade={s.resultGrade} /> {s.resultPct}%</div>
          </li>
        ))}
      </ol>
      <p className="sub" style={{ fontSize: '0.82rem', margin: '10px 0 0' }}>
        Antes de farmar, veja o botão Otimizar na aba Equipes: ele procura peças assim que já estão em outros personagens.
      </p>
      <GradeExplainer />
    </section>
  )
}

/** explicação da nota dos artefatos, em linguagem simples */
export function GradeExplainer() {
  return (
    <Info label="Como a nota é calculada?">
      <p>
        Cada artefato nasce com 3 ou 4 substatus. A cada 4 níveis, até o +20, um deles sobe por sorte. Uma peça 5★ no +20
        juntou de 8 a 9 dessas subidas.
      </p>
      <p>
        A nota conta quantas subidas caíram em atributos que ajudam <b>este</b> personagem, segundo o guia (em negrito na
        peça). Subida em atributo que não serve, como DEF numa personagem de ataque, não conta.
      </p>
      <p>
        Cerca de 7 subidas úteis por peça é nota máxima (<b>S</b>). Uma peça boa tem de 4 a 5 (<b>A</b>). Atributo principal
        errado no Relógio, Cálice ou Tiara derruba a nota da peça.
      </p>
    </Info>
  )
}
