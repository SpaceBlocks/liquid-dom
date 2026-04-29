import { asInternalNode, BaseLayoutNode } from './node'
import type {
  LayoutChild,
  LayoutDebugStats,
  LayoutEngine,
  LayoutEngineOptions,
  LayoutNode,
  LeafNode,
  LeafSubscribe,
  ProposedSize,
  Rect,
  Size,
} from './types'
import { proposalKey, sanitizeProposal, sanitizeRect, sanitizeSize, stableSerialize } from './utils'

type SubscriptionRecord = {
  cleanup: (() => void) | undefined
  node: BaseLayoutNode
  subscribe: LeafSubscribe
  subscriptionKey: unknown
}

const EMPTY_STATS: LayoutDebugStats = {
  measureCalls: 0,
  cacheHits: 0,
  cacheMisses: 0,
  invalidations: 0,
  activeSubscriptions: 0,
  nodes: 0,
}

export function createLayoutEngine(
  options: LayoutEngineOptions = {},
): LayoutEngine {
  return new DefaultLayoutEngine(options)
}

class DefaultLayoutEngine implements LayoutEngine {
  private rootNode: BaseLayoutNode | undefined
  private readonly onInvalidate: LayoutEngineOptions['onInvalidate']
  private readonly maxCachedMeasurements: number
  private readonly measureCache = new Map<string, Size>()
  private readonly subscriptions = new Map<string, SubscriptionRecord>()
  private readonly objectIds = new WeakMap<object, number>()
  private objectIdCounter = 0
  private invalidationCount = 0
  private lastStats: LayoutDebugStats = { ...EMPTY_STATS }
  private cleanupRootListener: (() => void) | undefined

  constructor(options: LayoutEngineOptions) {
    this.onInvalidate = options.onInvalidate
    this.maxCachedMeasurements = options.maxCachedMeasurements ?? 50_000
    this.root = options.root
  }

  get root(): LayoutNode | undefined {
    return this.rootNode
  }

  set root(value: LayoutNode | undefined) {
    const nextRoot = value ? asInternalNode(value) : undefined
    if (this.rootNode === nextRoot) return

    this.cleanupRootListener?.()
    this.cleanupRootListener = undefined
    this.rootNode = nextRoot

    if (nextRoot) {
      this.cleanupRootListener = nextRoot.addTreeListener(() => this.syncSubscriptions())
    }

    this.syncSubscriptions()
  }

  layout(proposal: ProposedSize): LayoutDebugStats {
    if (!this.rootNode || this.rootNode.disposed) {
      throw new Error('layout() called before assigning engine.root.')
    }

    this.syncSubscriptions()

    const stats = { ...EMPTY_STATS, invalidations: this.invalidationCount }
    const cleanProposal = sanitizeProposal(proposal)
    const size = this.measureNode(this.rootNode, cleanProposal, stats)
    this.placeNode(
      this.rootNode,
      {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
      },
      cleanProposal,
      stats,
    )

    stats.activeSubscriptions = this.subscriptions.size
    this.lastStats = stats
    return stats
  }

  getDebugStats(): LayoutDebugStats {
    return {
      ...this.lastStats,
      invalidations: this.invalidationCount,
      activeSubscriptions: this.subscriptions.size,
    }
  }

  dispose() {
    this.cleanupRootListener?.()
    this.cleanupRootListener = undefined
    for (const id of [...this.subscriptions.keys()]) {
      this.disposeSubscription(id)
    }
    this.rootNode = undefined
    this.measureCache.clear()
  }

  private measureNode(
    node: BaseLayoutNode,
    proposal: ProposedSize,
    stats: LayoutDebugStats,
  ): Size {
    const key = this.measureCacheKey(node, proposal)
    if (this.maxCachedMeasurements > 0) {
      const cached = this.measureCache.get(key)
      if (cached) {
        stats.cacheHits += 1
        return cached
      }
    }

    stats.cacheMisses += 1
    stats.measureCalls += 1

    const children = this.childrenFor(node, stats)
    const measured = sanitizeSize(
      node.measureSelf({
        proposal,
        children,
        node,
      }),
    )
    this.setCachedMeasurement(key, measured)
    return measured
  }

  private placeNode(
    node: BaseLayoutNode,
    bounds: Rect,
    proposal: ProposedSize,
    stats: LayoutDebugStats,
  ): void {
    const rect = sanitizeRect(bounds)
    node.setLayout({
      rect,
    })
    stats.nodes += 1

    const children = this.childrenFor(node, stats)
    const localBounds = {
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height,
    }
    node.placeChildren({
      bounds: localBounds,
      proposal: sanitizeProposal(proposal),
      children,
      node,
    })
  }

  private childrenFor(node: BaseLayoutNode, stats: LayoutDebugStats): LayoutChild[] {
    return node.children.map((child) => {
      const childNode = asInternalNode(child)
      return {
        node: child,
        id: child.id,
        kind: child.kind,
        isSpacer: childNode.isSpacer,
        measure: (proposal) => this.measureNode(childNode, sanitizeProposal(proposal), stats),
        place: (bounds, proposal) =>
          this.placeNode(childNode, bounds, sanitizeProposal(proposal ?? bounds), stats),
      }
    })
  }

  private syncSubscriptions() {
    const reachable = new Map<string, BaseLayoutNode>()
    if (this.rootNode && !this.rootNode.disposed) {
      this.collectReachable(this.rootNode, reachable)
    }

    for (const [id, record] of [...this.subscriptions.entries()]) {
      const current = reachable.get(id)
      const spec = current?.getSubscriptionSpec()
      if (!current || current.disposed || !spec?.subscribe || spec.subscribe !== record.subscribe || !Object.is(spec.subscriptionKey, record.subscriptionKey)) {
        this.disposeSubscription(id)
      }
    }

    for (const node of reachable.values()) {
      const spec = node.getSubscriptionSpec()
      if (!spec?.subscribe || this.subscriptions.has(node.id)) continue

      const notify = (cause?: unknown) => {
        if (!this.isReachable(node)) return
        node.markMeasureDirty()
        this.invalidationCount += 1
        this.onInvalidate?.(cause === undefined ? { id: node.id, node } : { id: node.id, node, cause })
      }
      const cleanup = spec.subscribe(notify, node as unknown as LeafNode)
      this.subscriptions.set(node.id, {
        cleanup: typeof cleanup === 'function' ? cleanup : undefined,
        node,
        subscribe: spec.subscribe,
        subscriptionKey: spec.subscriptionKey,
      })
    }
  }

  private collectReachable(node: BaseLayoutNode, reachable: Map<string, BaseLayoutNode>) {
    reachable.set(node.id, node)
    for (const child of node.children) {
      this.collectReachable(asInternalNode(child), reachable)
    }
  }

  private isReachable(node: BaseLayoutNode): boolean {
    let current: BaseLayoutNode | null = node
    while (current) {
      if (current === this.rootNode) return !current.disposed
      current = current.parent ? asInternalNode(current.parent) : null
    }
    return false
  }

  private disposeSubscription(id: string) {
    const record = this.subscriptions.get(id)
    if (!record) return
    record.cleanup?.()
    this.subscriptions.delete(id)
  }

  private measureCacheKey(node: BaseLayoutNode, proposal: ProposedSize): string {
    return [
      node.id,
      proposalKey(proposal),
      node.measureRevision,
      node.subtreeMeasureRevision,
      this.valueSignature(node.getMeasureKey()),
    ].join('|')
  }

  private setCachedMeasurement(key: string, size: Size) {
    if (this.maxCachedMeasurements <= 0) {
      return
    }
    if (this.measureCache.size >= this.maxCachedMeasurements) {
      this.measureCache.clear()
    }
    this.measureCache.set(key, size)
  }

  private valueSignature(value: unknown): string {
    if (value === null || value === undefined) return String(value)
    if (typeof value === 'object' || typeof value === 'function') {
      return `object:${this.objectId(value as object)}`
    }
    return stableSerialize(value)
  }

  private objectId(value: object): number {
    const existing = this.objectIds.get(value)
    if (existing !== undefined) return existing
    const id = ++this.objectIdCounter
    this.objectIds.set(value, id)
    return id
  }
}
