import { createLayoutEngine, hstack, leaf, vstack } from 'laymeout'
import type { LayoutNode } from 'laymeout'
import { percentile, toneFor } from './visual'
import type { VisualBox } from './visual'

export type PerfConfig = {
  depth: number
  breadth: number
  iterations: number
  invalidationRate: number
  proposalChurn: boolean
  dynamicReorder: boolean
}

export type PerfSample = {
  root: LayoutNode
  boxes: VisualBox[]
}

export type PerfResult = {
  durations: number[]
  sample: PerfSample | undefined
  nodes: number
  measureCalls: number
  cacheHitRatio: number
  invalidations: number
  activeSubscriptions: number
}

export function defaultPerfConfig(): PerfConfig {
  return {
    depth: 4,
    breadth: 3,
    iterations: 160,
    invalidationRate: 0.1,
    proposalChurn: true,
    dynamicReorder: false,
  }
}

export function runProfile(config: PerfConfig): PerfResult {
  const engine = createLayoutEngine()
  const notifiers: (() => void)[] = []
  const durations: number[] = []
  let measureCalls = 0
  let cacheHits = 0
  let cacheMisses = 0
  let sample: PerfSample | undefined
  let nodes = 0
  let invalidations = 0
  let activeSubscriptions = 0

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    notifiers.splice(0)
    const tree = buildProfileTree(config.depth, config.breadth, 'root', iteration, config.dynamicReorder, notifiers)
    engine.root = tree.root

    const invalidationBudget = Math.floor(notifiers.length * config.invalidationRate)
    for (let index = 0; index < invalidationBudget; index += 1) {
      notifiers[index]?.()
    }

    const proposal = {
      width: config.proposalChurn ? 640 + (iteration % 6) * 8 : 680,
      height: 360,
    }
    const startedAt = performance.now()
    const stats = engine.layout(proposal)
    durations.push(performance.now() - startedAt)
    measureCalls += stats.measureCalls
    cacheHits += stats.cacheHits
    cacheMisses += stats.cacheMisses
    nodes = stats.nodes
    invalidations = stats.invalidations
    activeSubscriptions = stats.activeSubscriptions
    if (iteration === config.iterations - 1) sample = tree
  }

  engine.dispose()

  return {
    durations,
    sample,
    nodes,
    measureCalls,
    cacheHitRatio: cacheHits / Math.max(1, cacheHits + cacheMisses),
    invalidations,
    activeSubscriptions,
  }
}

export function profileP50(result: PerfResult) {
  return percentile(result.durations, 0.5)
}

export function profileP95(result: PerfResult) {
  return percentile(result.durations, 0.95)
}

function buildProfileTree(
  depth: number,
  breadth: number,
  path: string,
  iteration: number,
  dynamicReorder: boolean,
  notifiers: (() => void)[],
): PerfSample {
  if (depth === 0) {
    const node = leaf({
      measure: () => ({
        width: 24 + (path.length % 5) * 8,
        height: 18 + (path.length % 4) * 4,
      }),
      subscribe: (notify) => {
        notifiers.push(() => notify())
      },
    })
    return {
      root: node,
      boxes: [{ node, id: path, label: path.split('-').at(-1) ?? path, tone: toneFor(path), role: 'leaf' }],
    }
  }

  const childTrees = Array.from({ length: breadth }, (_, index) =>
    buildProfileTree(depth - 1, breadth, `${path}-${index}`, iteration, dynamicReorder, notifiers),
  )
  if (dynamicReorder && iteration % 2 === 1) childTrees.reverse()

  const children = childTrees.map((tree) => tree.root)
  const root = depth % 2 === 0
    ? hstack({ spacing: 3, alignment: 'center' }, children)
    : vstack({ spacing: 3, alignment: 'leading' }, children)

  return {
    root,
    boxes: childTrees.flatMap((tree) => tree.boxes),
  }
}
