import type {
  DataTexture,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  WebGLRenderTarget,
} from 'three'
import type { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import type { LayoutNode, LeafNode } from '@liquid-dom/layout'
import type { Grid2x3 } from './layout/Grid2x3'

export type RenderRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CornerRadii = {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

export type CornerRadiiInput = number | CornerRadii

export type HoverTarget = {
  panelIndex: number
  tileIndex: number
}

export type GridLayoutProps = {
  columns: number
  rows: number
  columnGap: number
  rowGap: number
}

export type AnimatedRectView = {
  currentRect: RenderRect | null
  targetRect: RenderRect | null
}

export type RectMeshView = AnimatedRectView & {
  mesh: Mesh<ExtrudeGeometry, MeshStandardMaterial | MeshPhysicalMaterial>
  geometryWidth: number
  geometryHeight: number
}

export type TileView = RectMeshView & {
  node: LeafNode
  hitMesh: Mesh<PlaneGeometry, MeshBasicMaterial>
  panelIndex: number
  tileIndex: number
  currentZ: number | null
  targetZ: number | null
}

export type TitleView = AnimatedRectView & {
  node: LeafNode
  mesh: Mesh<TextGeometry, MeshStandardMaterial>
}

export type PanelView = {
  node: LayoutNode
  grid: Grid2x3
  gridPadding: LayoutNode
  title: TitleView
  background: RectMeshView
  tiles: TileView[]
}

export type EnvironmentMap = {
  background: DataTexture
  renderTarget: WebGLRenderTarget
}

export type DomRefs = {
  canvas: HTMLCanvasElement
  tileSizeReadout: HTMLElement
  nodeCountReadout: HTMLElement
}
