import { Link, NavLink } from 'react-router-dom'
import { ELEMENT_COLOR } from '../../shared/labels'
import type { Element } from '../../shared/types'
import type { Grade } from '../../shared/view-types'

export function GradeBadge({ grade, title }: { grade: Grade; title?: string }) {
  return <span className={`grade ${grade}`} title={title ?? `Nota ${grade}`}>{grade}</span>
}

interface CardProps {
  id: string
  name: string
  icon?: string
  rarity: number
  element?: Element
  sub?: string
  constellation?: number
  grade?: Grade
  link?: boolean
  /** destino do link (padrão: página do personagem) */
  to?: string
  className?: string
}

export function CharCard({ id, name, icon, rarity, element, sub, constellation, grade, link = true, to, className = '' }: CardProps) {
  const body = (
    <>
      <div className="portrait">
        {icon && <img src={icon} alt="" loading="lazy" />}
        {element && <span className="el" style={{ background: ELEMENT_COLOR[element] }} title={element} />}
        {constellation !== undefined && constellation > 0 && <span className="cons">C{constellation}</span>}
        {grade && <GradeBadge grade={grade} title={`Nota dos artefatos: ${grade} (avaliação do app, não do jogo)`} />}
      </div>
      <div className="label">
        {name}
        {sub && <span className="lvl">{sub}</span>}
      </div>
    </>
  )
  const cls = `card r${rarity >= 5 ? 5 : 4} ${className}`
  return link ? <Link to={to ?? `/personagens/${id}`} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export function EmptyAccount() {
  return (
    <div className="empty">
      <h2>Nenhum personagem carregado</h2>
      <p className="muted">Configure o UID na aba Conta e toque em Atualizar.</p>
      <Link className="btn solid" to="/conta">Configurar conta</Link>
    </div>
  )
}

/** âncora estável para cada equipe na página de Equipes */
export const teamSlug = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const memberLink = (charId: string, teamName: string) =>
  `/personagens/${charId}?equipe=${encodeURIComponent(teamName)}`

/** ícone que não carregou fica invisível (mantém o espaço, some a caixa quebrada) */
export const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden' }

/** abre o mapa do app com os pontos do material */
export function MapLink({ url }: { url: string }) {
  return <Link className="map-link" to={url}>Ver no mapa</Link>
}

/** domínios não têm ponto identificável no mapa: o jogo leva até eles */
export const DOMAIN_HINT = 'Para ir até o domínio: no jogo, abra o Manual do Aventureiro › Domínios e use a navegação até ele.'


/** alterna entre a lista de personagens e a de armas */
export function RosterSwitch() {
  return (
    <nav className="seg roster-switch" aria-label="Personagens, armas ou artefatos">
      <NavLink to="/personagens" end className={({ isActive }) => (isActive ? 'on' : '')}>Personagens</NavLink>
      <NavLink to="/armas" className={({ isActive }) => (isActive ? 'on' : '')}>Armas</NavLink>
      <NavLink to="/artefatos" className={({ isActive }) => (isActive ? 'on' : '')}>Artefatos</NavLink>
    </nav>
  )
}

/** ícones simples (traço), no tamanho do texto ao redor */
const ICON_PATHS: Record<string, string> = {
  hoje: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  personagens: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  equipes: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3zM9 12l2 2 4-4',
  desejos: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  conta: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  atualizar: 'M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  voltar: 'M15 18l-6-6 6-6',
  mapa: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  check: 'M20 6L9 17l-5-5',
}

export function Icon({ name, size = 20 }: { name: keyof typeof ICON_PATHS | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name] ?? ''} />
    </svg>
  )
}

/** número legível dentro de títulos (a fonte dos títulos usa algarismos antigos: 1 parece I, 0 parece O) */
export function Count({ n }: { n: number }) {
  return <span className="count">{n}</span>
}

/** explicação recolhida atrás de um "Como funciona?" — evita parágrafos fixos no topo das telas */
export function Info({ label = 'Como funciona?', children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="info">
      <summary><Icon name="info" size={16} />{label}</summary>
      <div className="info-body">{children}</div>
    </details>
  )
}

/** seletor segmentado (abas dentro de uma tela) */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: React.ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** "há 2 h" a partir de uma data ISO */
export function ago(iso?: string) {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}
