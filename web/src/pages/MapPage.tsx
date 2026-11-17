import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { MaterialMap } from '../../../shared/view-types'
import { request } from '../api'
import { Icon, hideImg } from '../components'

// px da imagem → coordenada do Leaflet (CRS.Simple: y cresce para cima)
const toLatLng = ([x, y]: [number, number] | [number, number, number]) => L.latLng(-y, x)

/** área com mais pontos: a célula de 2048 px mais cheia e as vizinhas */
function densestBounds(points: [number, number, number][], cell: number) {
  const counts = new Map<string, number>()
  for (const [x, y] of points) {
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const [bx, by] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
  const near = points.filter(([x, y]) => Math.abs(Math.floor(x / cell) - bx) <= 1 && Math.abs(Math.floor(y / cell) - by) <= 1)
  return L.latLngBounds(near.map(toLatLng))
}

export function MapPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const el = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<MaterialMap>()
  const [error, setError] = useState<string>()
  const mapRef = useRef<L.Map | undefined>(undefined)
  const [collected, setCollected] = useState<Set<number>>(new Set())
  const [hideCollected, setHideCollected] = useState(false)
  const markers = useRef(new Map<number, L.CircleMarker>())

  useEffect(() => {
    request<MaterialMap>('GET', `map/${id}`).then((d) => { setData(d); setCollected(new Set(d.collected)) }, (e) => setError(e.message))
  }, [id])

  useEffect(() => {
    if (!data || !el.current) return
    const [w, h] = data.size
    const map = L.map(el.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 1,
      zoomSnap: 0.5,
      attributionControl: false,
      maxBounds: L.latLngBounds([-h, 0], [0, w]).pad(0.05),
    })
    mapRef.current = map

    // só baixa os pedaços (2048 px, ~650 KB cada) que estão na tela
    const loaded = new Set<string>()
    const loadVisible = () => {
      const b = map.getBounds()
      const c0 = Math.max(0, Math.floor(b.getWest() / data.slice) - 1)
      const c1 = Math.min(data.slices[0].length - 1, Math.floor(b.getEast() / data.slice) + 1)
      const r0 = Math.max(0, Math.floor(-b.getNorth() / data.slice) - 1)
      const r1 = Math.min(data.slices.length - 1, Math.floor(-b.getSouth() / data.slice) + 1)
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const key = `${r},${c}`
          if (loaded.has(key)) continue
          loaded.add(key)
          const s = data.slice
          L.imageOverlay(data.slices[r][c], [[-(r + 1) * s, c * s], [-r * s, (c + 1) * s]], { className: 'map-slice' }).addTo(map).bringToBack()
        }
      }
    }
    map.on('moveend zoomend', loadVisible)

    // tocar num ponto marca/desmarca como coletado (salvo na conta)
    markers.current.clear()
    for (const p of data.points) {
      const mk = L.circleMarker(toLatLng(p), { radius: 9, weight: 2 }).addTo(map)
      mk.on('click', () => toggle(p[2]))
      markers.current.set(p[2], mk)
    }
    map.fitBounds(densestBounds(data.points, data.slice), { padding: [40, 40], maxZoom: -0.5 })
    loadVisible()
    return () => { map.remove(); mapRef.current = undefined }
  }, [data])

  // estilo de cada ponto acompanha o estado (coletado fica apagado ou some)
  useEffect(() => {
    for (const [pid, mk] of markers.current) {
      const done = collected.has(pid)
      mk.setStyle(done
        ? { color: '#6b6f80', fillColor: '#3b4255', fillOpacity: hideCollected ? 0 : 0.7, opacity: hideCollected ? 0 : 1 }
        : { color: '#1d2236', fillColor: '#f0c75e', fillOpacity: 1, opacity: 1 })
    }
  }, [collected, hideCollected, data])

  // a referência guarda o estado atual para o clique no marcador (criado uma vez) ler sempre o valor certo
  const collectedRef = useRef(collected)
  collectedRef.current = collected
  const toggle = (pid: number) => {
    const next = new Set(collectedRef.current)
    const done = !next.has(pid)
    if (done) next.add(pid)
    else next.delete(pid)
    setCollected(next)
    request('POST', 'map/marks', { points: [pid], collected: done }).catch((e) => setError(`Não salvou a marcação: ${e.message}`))
  }

  const clearAll = () => {
    const ids = [...collected]
    setCollected(new Set())
    for (let i = 0; i < ids.length; i += 500) {
      request('POST', 'map/marks', { points: ids.slice(i, i + 500), collected: false }).catch(() => {})
    }
  }

  const showAll = () => {
    if (data && mapRef.current) mapRef.current.fitBounds(L.latLngBounds(data.points.map(toLatLng)), { padding: [30, 30] })
  }

  return (
    <div className="map-page">
      <div className="map-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Voltar"><Icon name="voltar" /></button>
        {data && (
          <div className="map-title">
            {data.icon && <img src={data.icon} alt="" onError={hideImg} />}
            <div>
              <b>{data.name}</b>
              <div className="muted">
                <b className="num">{collected.size}</b> de {data.points.length} coletados
              </div>
            </div>
          </div>
        )}
      </div>
      {data && (
        <div className="filters map-tools" role="group" aria-label="Opções do mapa">
          <button className="chip" onClick={showAll}>Ver todos</button>
          <button className="chip" aria-pressed={hideCollected} onClick={() => setHideCollected(!hideCollected)}>Esconder coletados</button>
          {collected.size > 0 && <button className="chip" onClick={clearAll}>Limpar marcações</button>}
          <a className="chip" href={data.officialUrl} target="_blank" rel="noopener noreferrer">Mapa oficial ↗</a>
        </div>
      )}
      {error && <div className="notice error">{error}</div>}
      <div ref={el} className="map-canvas" role="application" aria-label={`Mapa de ${data?.name ?? 'Teyvat'}`} />
      <p className="muted map-help">
        Toque num ponto para marcar como coletado. Fica salvo na sua conta e volta sozinho em {data?.respawnHours ?? 48} h,
        quando o item renasce.{data?.where ? ` Onde: ${data.where}.` : ''}
      </p>
    </div>
  )
}
