import type {
  ChildInput,
  LayoutNode,
  LayoutPlaceInput,
  LayoutMeasureInput,
  LeafSubscribe,
  NodeLayout,
  Size,
} from './types'

let nextNodeId = 0

export type SubscriptionSpec = {
  subscribe: LeafSubscribe | undefined
}

export class BaseLayoutNode implements LayoutNode {
  readonly __laymeout = true
  readonly id: string
  readonly kind: string

  private _parent: BaseLayoutNode | null = null
  private _children: BaseLayoutNode[] = []
  private _layout: NodeLayout | undefined
  private _measureRevision = 0
  private _subtreeMeasureRevision = 0
  private _structureRevision = 0
  private _disposed = false
  private readonly treeListeners = new Set<() => void>()

  isSpacer = false

  constructor(kind: string, options: { isSpacer?: boolean } = {}) {
    this.id = `node:${++nextNodeId}`
    this.kind = kind
    this.isSpacer = options.isSpacer ?? false
  }

  get parent(): LayoutNode | null {
    return this._parent
  }

  get children(): readonly LayoutNode[] {
    return this._children
  }

  get layout(): NodeLayout | undefined {
    return this._layout
  }

  get measureRevision(): number {
    return this._measureRevision
  }

  get subtreeMeasureRevision(): number {
    return this._subtreeMeasureRevision
  }

  get structureRevision(): number {
    return this._structureRevision
  }

  get disposed(): boolean {
    return this._disposed
  }

  append(...children: LayoutNode[]) {
    for (const child of children) {
      this.insertAt(this._children.length, child)
    }
  }

  prepend(...children: LayoutNode[]) {
    let index = 0
    for (const child of children) {
      this.insertAt(index, child)
      index += 1
    }
  }

  insertBefore(child: LayoutNode, before: LayoutNode) {
    const beforeNode = asInternalNode(before)
    const index = this._children.indexOf(beforeNode)
    if (index === -1) {
      throw new Error('insertBefore expected the reference node to be a child of this layout node.')
    }
    this.insertAt(index, child)
  }

  replaceChildren(...children: LayoutNode[]) {
    for (const child of this._children) {
      child._parent = null
    }
    this._children = []
    for (const child of children) {
      this.insertAt(this._children.length, child, false)
    }
    this.markStructureDirty()
    this.notifyTreeChanged()
  }

  remove() {
    this._parent?.detachChild(this)
  }

  dispose() {
    if (this._disposed) return
    this.remove()
    for (const child of [...this._children]) {
      child.dispose()
    }
    this._disposed = true
    this.markStructureDirty()
    this.notifyTreeChanged()
  }

  setLayout(layout: NodeLayout) {
    this._layout = layout
  }

  measureSelf(input: LayoutMeasureInput): Size {
    void input
    return { width: 0, height: 0 }
  }

  placeChildren(input: LayoutPlaceInput): void {
    void input
  }

  getMeasureKey(): unknown {
    return undefined
  }

  getSubscriptionSpec(): SubscriptionSpec | undefined {
    return undefined
  }

  addTreeListener(listener: () => void): () => void {
    this.treeListeners.add(listener)
    return () => {
      this.treeListeners.delete(listener)
    }
  }

  markMeasureDirty() {
    this._measureRevision += 1
    this.markSubtreeMeasureDirty()
  }

  protected markPlacementDirty() {
    this._structureRevision += 1
  }

  protected notifyTreeChanged() {
    for (const listener of this.treeListeners) {
      listener()
    }
    this._parent?.notifyTreeChanged()
  }

  private insertAt(index: number, child: LayoutNode, notify = true) {
    const childNode = asInternalNode(child)
    this.assertCanAdopt(childNode)

    let nextIndex = Math.max(0, Math.min(index, this._children.length))
    if (childNode._parent === this) {
      const currentIndex = this._children.indexOf(childNode)
      if (currentIndex === -1) return
      this._children.splice(currentIndex, 1)
      if (currentIndex < nextIndex) nextIndex -= 1
    } else {
      childNode._parent?.detachChild(childNode)
    }

    this._children.splice(nextIndex, 0, childNode)
    childNode._parent = this
    this.markStructureDirty()
    if (notify) this.notifyTreeChanged()
  }

  private detachChild(childNode: BaseLayoutNode) {
    const index = this._children.indexOf(childNode)
    if (index === -1) return
    this._children.splice(index, 1)
    childNode._parent = null
    this.markStructureDirty()
    this.notifyTreeChanged()
  }

  private assertCanAdopt(child: BaseLayoutNode) {
    if (child === this) {
      throw new Error('A layout node cannot be inserted into itself.')
    }

    let ancestor: BaseLayoutNode | null = this
    while (ancestor) {
      if (ancestor === child) {
        throw new Error('A layout node cannot be inserted into one of its descendants.')
      }
      ancestor = ancestor._parent
    }
  }

  private markStructureDirty() {
    this._structureRevision += 1
    this.markMeasureDirty()
  }

  private markSubtreeMeasureDirty() {
    this._subtreeMeasureRevision += 1
    this._parent?.markSubtreeMeasureDirty()
  }
}

export function isLayoutNode(value: unknown): value is LayoutNode {
  return Boolean(value && typeof value === 'object' && (value as { __laymeout?: unknown }).__laymeout === true)
}

export function asInternalNode(node: LayoutNode): BaseLayoutNode {
  if (node instanceof BaseLayoutNode) return node
  throw new Error('Expected a Laymeout retained node.')
}

export function normalizeChildInputs(inputs: readonly ChildInput[]): LayoutNode[] {
  const children: LayoutNode[] = []
  for (const input of inputs) {
    if (input === null || input === false || input === undefined) continue
    if (Array.isArray(input)) {
      for (const child of input) {
        if (child !== null && child !== false && child !== undefined) children.push(child)
      }
    } else if (isLayoutNode(input)) {
      children.push(input)
    }
  }
  return children
}

export function splitOptions<Options extends object>(
  args: readonly unknown[],
  defaultOptions: Options,
): { options: Options; children: ChildInput[] } {
  const [first, ...rest] = args

  if (first === undefined || first === null || first === false || Array.isArray(first) || isLayoutNode(first)) {
    return { options: defaultOptions, children: args as ChildInput[] }
  }

  return { options: { ...defaultOptions, ...(first as Partial<Options>) }, children: rest as ChildInput[] }
}
