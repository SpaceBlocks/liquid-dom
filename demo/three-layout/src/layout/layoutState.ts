import type { Size } from '@liquid-dom/layout'
import {
  COLUMN_GAP_RATIO,
  GRID_COLUMNS,
  GRID_ROWS,
  HOVER_SCALE,
  NON_HOVER_SCALE,
  ROW_GAP_RATIO,
  TILE_MAX_SIZE,
  TILE_MIN_SIZE,
} from '../config'
import type { GridLayoutProps, HoverTarget } from '../types'

export const layoutState = {
  tileSize: 140,
  columnGap: 28,
  rowGap: 30,
  hoveredTile: null as HoverTarget | null,
}

export function updateResponsiveLayoutState(width: number, height: number) {
  layoutState.tileSize = clamp(Math.min(width * 0.145, height * 0.25), TILE_MIN_SIZE, TILE_MAX_SIZE)
  layoutState.columnGap = clamp(layoutState.tileSize * COLUMN_GAP_RATIO, 10, 30)
  layoutState.rowGap = clamp(layoutState.tileSize * ROW_GAP_RATIO, 12, 36)
}

export function tileSizeFor(panelIndex: number, tileIndex: number): Size {
  const hoveredTile = layoutState.hoveredTile?.panelIndex === panelIndex ? layoutState.hoveredTile.tileIndex : null
  const hoveredColumn = hoveredTile === null ? null : hoveredTile % GRID_COLUMNS
  const hoveredRow = hoveredTile === null ? null : Math.floor(hoveredTile / GRID_COLUMNS)
  const column = tileIndex % GRID_COLUMNS
  const row = Math.floor(tileIndex / GRID_COLUMNS)
  const widthScale = hoveredTile === null
    ? 1
    : hoveredColumn === column
      ? HOVER_SCALE
      : NON_HOVER_SCALE
  const heightScale = hoveredTile === null
    ? 1
    : hoveredRow === row
      ? HOVER_SCALE
      : NON_HOVER_SCALE

  return {
    width: layoutState.tileSize * widthScale,
    height: layoutState.tileSize * heightScale,
  }
}

export function tileMeasureKey(panelIndex: number, tileIndex: number) {
  const size = tileSizeFor(panelIndex, tileIndex)
  return `${size.width}:${size.height}`
}

export function gridProps(): GridLayoutProps {
  return {
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    columnGap: layoutState.columnGap,
    rowGap: layoutState.rowGap,
  }
}

export function hoverTileSizeReadout() {
  return Math.round(layoutState.hoveredTile === null ? layoutState.tileSize : layoutState.tileSize * HOVER_SCALE)
}

export function stackRenderOffsetY() {
  return layoutState.hoveredTile === null ? 0 : (layoutState.tileSize * (HOVER_SCALE - 1)) * 0.5
}

export function sameHoverTarget(a: HoverTarget | null, b: HoverTarget | null) {
  return a?.panelIndex === b?.panelIndex && a?.tileIndex === b?.tileIndex
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
