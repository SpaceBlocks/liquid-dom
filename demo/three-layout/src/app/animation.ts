import type { AnimationManager } from '@liquid-dom/layout/animation'
import { LAYOUT_SPRING, TILE_HOVER_Z_LIFT, TILE_LIFT_SPRING } from '../config'
import { layoutState } from '../layout/layoutState'
import type { AnimatedRectView, PanelView, RenderRect, TileView } from '../types'

export function setRectTarget(
  animationManager: AnimationManager,
  view: AnimatedRectView,
  targetRect: RenderRect,
  immediate: boolean,
  applyRect: (rect: RenderRect) => void,
) {
  view.targetRect = targetRect

  if (immediate || !view.currentRect) {
    animationManager.stop(view, ['currentRect'])
    view.currentRect = targetRect
    applyRect(targetRect)
  } else {
    animationManager.animate(view, { currentRect: targetRect }, LAYOUT_SPRING)
  }
}

export function setTileZTarget(animationManager: AnimationManager, tile: TileView, targetZ: number, immediate: boolean) {
  tile.targetZ = targetZ

  if (immediate || tile.currentZ === null) {
    animationManager.stop(tile, ['currentZ'])
    tile.currentZ = targetZ
    tile.mesh.position.z = targetZ
  } else {
    animationManager.animate(tile, { currentZ: targetZ }, TILE_LIFT_SPRING)
  }
}

export function tileTargetZ(tile: TileView) {
  return layoutState.hoveredTile?.panelIndex === tile.panelIndex &&
    layoutState.hoveredTile.tileIndex === tile.tileIndex
    ? TILE_HOVER_Z_LIFT
    : 0
}

export function stopPanelAnimations(animationManager: AnimationManager, panels: PanelView[]) {
  for (const panel of panels) {
    animationManager.stop(panel.background, ['currentRect'])
    animationManager.stop(panel.title, ['currentRect'])
    for (const tile of panel.tiles) {
      animationManager.stop(tile, ['currentRect'])
      animationManager.stop(tile, ['currentZ'])
    }
  }
}
