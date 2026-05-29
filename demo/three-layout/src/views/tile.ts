import { Mesh } from 'three'
import type { MeshBasicMaterial, PlaneGeometry } from 'three'
import { GRID_COLUMNS, GRID_ROWS, HIT_PROXY_Z } from '../config'
import { layoutState, tileMeasureKey, tileSizeFor } from '../layout/layoutState'
import { createTileGeometry, tileCornerRadii } from '../three/geometry'
import { createTileMaterial } from '../three/materials'
import type { RenderRect, TileView } from '../types'
import { MeasuredLeaf } from '../layout/MeasuredLeaf'
import { applyRectMesh } from './rectMesh'

export function createTileView(
  panelIndex: number,
  tileIndex: number,
  color: number,
  hitProxyGeometry: PlaneGeometry,
  hitProxyMaterial: MeshBasicMaterial,
): TileView {
  const node = new MeasuredLeaf(
    () => tileSizeFor(panelIndex, tileIndex),
    {
      measureKey: tileMeasureKey(panelIndex, tileIndex),
    },
  )
  const geometrySize = tileSizeFor(panelIndex, tileIndex)
  const mesh = new Mesh(
    createTileGeometry(geometrySize.width, geometrySize.height, tileCornerRadii(tileIndex)),
    createTileMaterial(color),
  )
  const hitMesh = new Mesh(hitProxyGeometry, hitProxyMaterial)
  hitMesh.position.z = HIT_PROXY_Z

  return {
    node,
    mesh,
    hitMesh,
    panelIndex,
    tileIndex,
    geometryWidth: geometrySize.width,
    geometryHeight: geometrySize.height,
    currentRect: null,
    targetRect: null,
    currentZ: null,
    targetZ: null,
  }
}

export function applyTileRect(tile: TileView, rect: RenderRect) {
  applyRectMesh(tile, rect, tileCornerRadii(tile.tileIndex))
  tile.mesh.position.z = tile.currentZ ?? 0

  const column = tile.tileIndex % GRID_COLUMNS
  const row = Math.floor(tile.tileIndex / GRID_COLUMNS)
  const leftMargin = column === 0 ? 0 : layoutState.columnGap * 0.5
  const rightMargin = column === GRID_COLUMNS - 1 ? 0 : layoutState.columnGap * 0.5
  const topMargin = row === 0 ? 0 : layoutState.rowGap * 0.5
  const bottomMargin = row === GRID_ROWS - 1 ? 0 : layoutState.rowGap * 0.5
  const proxyLeft = rect.x - rect.width * 0.5 - leftMargin
  const proxyRight = rect.x + rect.width * 0.5 + rightMargin
  const proxyTop = rect.y + rect.height * 0.5 + topMargin
  const proxyBottom = rect.y - rect.height * 0.5 - bottomMargin

  tile.hitMesh.position.x = (proxyLeft + proxyRight) * 0.5
  tile.hitMesh.position.y = (proxyTop + proxyBottom) * 0.5
  tile.hitMesh.scale.set(proxyRight - proxyLeft, proxyTop - proxyBottom, 1)
}
