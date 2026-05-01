export type ProposedSize = {
  width?: number
  height?: number
}

export type Size = {
  width: number
  height: number
}

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type NodeLayout = {
  rect: Rect
}

export type Axis = 'horizontal' | 'vertical'
export type StackAlignment = 'start' | 'center' | 'end' | 'leading' | 'trailing' | 'top' | 'bottom'
export type Alignment =
  | 'center'
  | 'top'
  | 'bottom'
  | 'leading'
  | 'trailing'
  | 'topLeading'
  | 'topTrailing'
  | 'bottomLeading'
  | 'bottomTrailing'
  | { x?: 'start' | 'center' | 'end'; y?: 'start' | 'center' | 'end' }

export type Length = number | 'infinity'

export type Insets = {
  top: number
  right: number
  bottom: number
  left: number
}

export type InsetsInput =
  | number
  | Partial<Insets>
  | {
      horizontal?: number
      vertical?: number
    }

export type ChildInput =
  | LayoutNode
  | readonly (LayoutNode | null | false | undefined)[]
  | null
  | false
  | undefined

export type LayoutNode = {
  readonly __laymeout: true
  readonly id: string
  readonly kind: string
  readonly parent: LayoutNode | null
  readonly children: readonly LayoutNode[]
  readonly layout: NodeLayout | undefined
  append: (...children: LayoutNode[]) => void
  prepend: (...children: LayoutNode[]) => void
  insertBefore: (child: LayoutNode, before: LayoutNode) => void
  replaceChildren: (...children: LayoutNode[]) => void
  remove: () => void
  dispose: () => void
}

export type StackNode = LayoutNode & {
  spacing: number
  alignment: StackAlignment
}

export type ZStackNode = LayoutNode & {
  alignment: Alignment
}

export type FrameNode = LayoutNode & {
  width: number | undefined
  height: number | undefined
  minWidth: number | undefined
  minHeight: number | undefined
  idealWidth: number | undefined
  idealHeight: number | undefined
  maxWidth: Length | undefined
  maxHeight: Length | undefined
  alignment: Alignment
}

export type PaddingNode = LayoutNode & {
  insets: InsetsInput
}

export type NoopNode = LayoutNode

export type DecorationNode = LayoutNode & {
  alignment: Alignment
}

export type SpacerNode = LayoutNode & {
  minLength: number
}

export type LeafMeasure = (proposal: ProposedSize, node: LeafNode) => Size

export type LeafSubscribe = (
  notify: (cause?: unknown) => void,
  node: LeafNode,
) => void | (() => void)

export type LeafNode = LayoutNode & {
  measure: LeafMeasure
  subscribe: LeafSubscribe | undefined
  measureKey: unknown
  invalidateMeasure: (cause?: unknown) => void
}

export type CustomLayoutNode = LayoutNode & {
  props: unknown
}

export type LayoutDebugStats = {
  measureCalls: number
  cacheHits: number
  cacheMisses: number
  invalidations: number
  activeSubscriptions: number
  nodes: number
}

export type LayoutInvalidation = {
  id: string
  node: LayoutNode
  cause?: unknown
}

export type LayoutChild = {
  node: LayoutNode
  id: string
  kind: string
  isSpacer: boolean
  measure: (proposal: ProposedSize) => Size
  place: (bounds: Rect, proposal?: ProposedSize) => void
}

export type LayoutMeasureInput = {
  proposal: ProposedSize
  children: LayoutChild[]
  node: LayoutNode
}

export type LayoutPlaceInput = {
  bounds: Rect
  proposal: ProposedSize
  children: LayoutChild[]
  node: LayoutNode
}

export type LayoutEngineOptions = {
  root?: LayoutNode
  onInvalidate?: (invalidation: LayoutInvalidation) => void
  dev?: boolean
  /**
   * Maximum measurement entries retained by the engine. Set to 0 to disable
   * measurement caching entirely.
   */
  maxCachedMeasurements?: number
}

export type LayoutEngine = {
  root: LayoutNode | undefined
  layout: (proposal: ProposedSize) => LayoutDebugStats
  getDebugStats: () => LayoutDebugStats
  dispose: () => void
}
