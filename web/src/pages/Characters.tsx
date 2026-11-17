import { useMemo, useState } from 'react'
import { ELEMENT_COLOR } from '../../../shared/labels'
import type { Element } from '../../../shared/types'
import type { CharacterView } from '../../../shared/view-types'
import { useApp } from '../App'
import { CharCard, EmptyAccount, Info, RosterSwitch } from '../components'

const ELEMENTS: Element[] = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro']

type Status = 'todos' | 'prontos' | 'preparar' | 'sem-artefatos'
const STATUS: { value: Status; label: string; test: (c: CharacterView) => boolean }[] = [
  { value: 'todos', label: 'Todos', test: () => true },
  { value: 'prontos', label: 'Prontos', test: (c) => c.readiness.ready },
  { value: 'preparar', label: 'Precisam preparo', test: (c) => !c.readiness.ready },
  { value: 'sem-artefatos', label: 'Sem artefatos', test: (c) => !c.artifacts.length },
]

export function Characters() {
  const { state } = useApp()
  const [element, setElement] = useState<Element>()
  const [status, setStatus] = useState<Status>('todos')
  const chars = state?.view?.characters ?? []
  const test = STATUS.find((s) => s.value === status)!.test
  const shown = useMemo(() => chars.filter((c) => (!element || c.element === element) && test(c)), [chars, element, test])

  if (!chars.length) return <EmptyAccount />

  return (
    <>
      <RosterSwitch />
      <Info label="O que é a letra no retrato?">
        <p>
          É a nota que o app dá aos <b>artefatos</b> do personagem, comparando com o guia dele (não existe no jogo):
          <b> S</b> ótimo · <b>A</b> bom · <b>B</b> ok · <b>C</b> fraco · <b>D</b> muito fraco. Sem letra: sem artefatos ou sem guia.
        </p>
        <p>O ponto amarelo no canto indica que o personagem ainda precisa de preparo (nível, arma ou artefatos).</p>
      </Info>

      <div className="filters" role="group" aria-label="Filtrar por situação">
        {STATUS.map((s) => {
          const n = chars.filter(s.test).length
          return (
            <button key={s.value} className="chip" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
              {s.label} <span className="chip-n">{n}</span>
            </button>
          )
        })}
      </div>
      <div className="filters" role="group" aria-label="Filtrar por elemento">
        <button className="chip" aria-pressed={!element} onClick={() => setElement(undefined)}>Todos os elementos</button>
        {ELEMENTS.filter((e) => chars.some((c) => c.element === e)).map((e) => (
          <button key={e} className="chip" aria-pressed={element === e} onClick={() => setElement(element === e ? undefined : e)}>
            <i className="el-dot" style={{ background: ELEMENT_COLOR[e] }} />{e}
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="roster">
          {shown.map((c) => (
            <CharCard
              key={c.id}
              id={c.id}
              name={c.name}
              icon={c.icon}
              rarity={c.rarity}
              element={c.element}
              constellation={c.constellation}
              sub={`Nv. ${c.level}`}
              grade={c.artifacts.length ? c.roles[c.bestRole]?.grade : undefined}
              className={c.readiness.ready ? '' : 'needs-prep'}
            />
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>Nenhum personagem com esse filtro.</p>
      )}
    </>
  )
}
