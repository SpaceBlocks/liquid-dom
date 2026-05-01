import { describe, expect, it, vi } from 'vitest'
import {
  background,
  createLayoutEngine,
  defineLayout,
  frame,
  hstack,
  leaf,
  noop,
  overlay,
  padding,
  spacer,
  vstack,
  zstack,
} from '../src/index'
import type { LayoutNode, ProposedSize, Rect, Size } from '../src/index'

function box(size: Size, options: { measure?: (proposal: ProposedSize) => Size } = {}) {
  return leaf({
    measure: options.measure ?? (() => size),
  })
}

function layout(root: LayoutNode, proposal: ProposedSize = {}) {
  const engine = createLayoutEngine({ root })
  const stats = engine.layout(proposal)
  engine.dispose()
  return stats
}

function rect(node: LayoutNode): Rect | undefined {
  return node.layout?.rect
}

describe('built-in layouts', () => {
  it('lays out hstack children with spacing and cross-axis alignment', () => {
    const first = box({ width: 10, height: 10 })
    const second = box({ width: 20, height: 20 })
    const root = hstack({ spacing: 5, alignment: 'center' }, first, second)

    layout(root)

    expect(rect(root)).toEqual({ x: 0, y: 0, width: 35, height: 20 })
    expect(rect(first)).toEqual({ x: 0, y: 5, width: 10, height: 10 })
    expect(rect(second)).toEqual({ x: 15, y: 0, width: 20, height: 20 })
  })

  it('expands spacers in finite hstack proposals', () => {
    const first = box({ width: 10, height: 10 })
    const gap = spacer()
    const second = box({ width: 10, height: 10 })
    const root = hstack({ spacing: 0, alignment: 'top' }, first, gap, second)

    layout(root, { width: 100, height: 10 })

    expect(rect(root)).toEqual({ x: 0, y: 0, width: 100, height: 10 })
    expect(rect(first)?.x).toBe(0)
    expect(rect(gap)).toEqual({ x: 10, y: 0, width: 80, height: 0 })
    expect(rect(second)?.x).toBe(90)
  })

  it('lays out vstack children vertically', () => {
    const first = box({ width: 10, height: 10 })
    const second = box({ width: 20, height: 5 })
    const root = vstack({ spacing: 3, alignment: 'trailing' }, first, second)

    layout(root)

    expect(rect(root)).toEqual({ x: 0, y: 0, width: 20, height: 18 })
    expect(rect(first)).toEqual({ x: 10, y: 0, width: 10, height: 10 })
    expect(rect(second)).toEqual({ x: 0, y: 13, width: 20, height: 5 })
  })

  it('lets zstack children jointly determine size and alignment', () => {
    const first = box({ width: 10, height: 10 })
    const second = box({ width: 30, height: 20 })
    const root = zstack({ alignment: 'bottomTrailing' }, first, second)

    layout(root)

    expect(rect(root)).toEqual({ x: 0, y: 0, width: 30, height: 20 })
    expect(rect(first)).toEqual({ x: 20, y: 10, width: 10, height: 10 })
    expect(rect(second)).toEqual({ x: 0, y: 0, width: 30, height: 20 })
  })

  it('applies frame proposal and clamping behavior', () => {
    const measured: ProposedSize[] = []
    const child = box(
      { width: 10, height: 10 },
      {
        measure: (proposal) => {
          measured.push(proposal)
          return { width: proposal.width ?? 10, height: 10 }
        },
      },
    )
    const root = frame(child, { width: 50, height: 20, alignment: 'trailing' })

    layout(root, { width: 100, height: 100 })

    expect(measured[0]).toEqual({ width: 50, height: 20 })
    expect(rect(root)).toEqual({ x: 0, y: 0, width: 50, height: 20 })
    expect(rect(child)).toEqual({ x: 0, y: 5, width: 50, height: 10 })
  })

  it('adds padding around child measurements and placement', () => {
    const child = box({ width: 10, height: 20 })
    const root = padding(child, { horizontal: 4, vertical: 2 })

    layout(root)

    expect(rect(root)).toEqual({ x: 0, y: 0, width: 18, height: 24 })
    expect(rect(child)).toEqual({ x: 4, y: 2, width: 10, height: 20 })
  })

  it('passes measurement and placement through noop', () => {
    const measured: ProposedSize[] = []
    const child = box(
      { width: 10, height: 20 },
      {
        measure: (proposal) => {
          measured.push(proposal)
          return { width: proposal.width ?? 10, height: proposal.height ?? 20 }
        },
      },
    )
    const root = noop(child)

    layout(root, { width: 30, height: 40 })

    expect(measured[0]).toEqual({ width: 30, height: 40 })
    expect(rect(root)).toEqual({ x: 0, y: 0, width: 30, height: 40 })
    expect(rect(child)).toEqual({ x: 0, y: 0, width: 30, height: 40 })
  })

  it('stores child rects in parent-local coordinates', () => {
    const leading = box({ width: 10, height: 10 })
    const nested = box({ width: 8, height: 8 })
    const padded = padding(nested, { left: 4 })
    const root = hstack({ spacing: 5, alignment: 'top' }, leading, padded)

    layout(root)

    expect(rect(root)).toEqual({ x: 0, y: 0, width: 27, height: 10 })
    expect(rect(padded)).toEqual({ x: 15, y: 0, width: 12, height: 8 })
    expect(rect(nested)).toEqual({ x: 4, y: 0, width: 8, height: 8 })
  })

  it('does not let background or overlay decorations affect measured size', () => {
    const backgroundContent = box({ width: 20, height: 10 })
    const backgroundDecoration = box({ width: 100, height: 80 })
    const overlayContent = box({ width: 20, height: 10 })
    const overlayDecoration = box({ width: 100, height: 80 })
    const withBackground = background(backgroundContent, backgroundDecoration)
    const withOverlay = overlay(overlayContent, overlayDecoration)

    layout(withBackground)
    layout(withOverlay)

    expect(rect(withBackground)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
    expect(rect(withOverlay)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
    expect(rect(backgroundContent)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
    expect(rect(overlayContent)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
    expect(rect(backgroundDecoration)).toEqual({ x: -40, y: -35, width: 100, height: 80 })
    expect(rect(overlayDecoration)).toEqual({ x: -40, y: -35, width: 100, height: 80 })
    expect(withBackground.children).toEqual([backgroundContent, backgroundDecoration])
    expect(withOverlay.children).toEqual([overlayContent, overlayDecoration])
  })

  it('writes rects on nodes and preserves graph metadata on retained nodes', () => {
    const content = box({ width: 20, height: 10 })
    const group = vstack(content)
    const decoration = box({ width: 20, height: 10 })
    const root = background(group, decoration)
    const rootId = root.id

    const stats = layout(root)

    expect(stats.nodes).toBe(4)
    expect(root.id).toBe(rootId)
    expect(root.parent).toBe(null)
    expect(root.children).toEqual([group, decoration])
    expect(group.parent).toBe(root)
    expect(group.children).toEqual([content])
    expect(rect(group)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
    expect(rect(root)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
    expect(rect(content)).toEqual({ x: 0, y: 0, width: 20, height: 10 })
  })

  it('supports command-style custom layout placement', () => {
    const first = box({ width: 10, height: 8 })
    const second = box({ width: 14, height: 12 })
    const custom = defineLayout(
      {
        kind: 'flow',
        measure: ({ children, proposal }) => {
          const sizes = children.map((child) => child.measure(proposal))
          return {
            width: sizes.reduce((sum, size) => sum + size.width, 0),
            height: sizes.reduce((max, size) => Math.max(max, size.height), 0),
          }
        },
        place: ({ bounds, children, proposal }) => {
          let x = bounds.x
          for (const child of children) {
            const size = child.measure(proposal)
            child.place({ x, y: bounds.y, width: size.width, height: size.height }, size)
            x += size.width
          }
        },
      },
      first,
      second,
    )

    layout(custom)

    expect(rect(custom)).toEqual({ x: 0, y: 0, width: 24, height: 12 })
    expect(rect(first)).toEqual({ x: 0, y: 0, width: 10, height: 8 })
    expect(rect(second)).toEqual({ x: 10, y: 0, width: 14, height: 12 })
  })
})

describe('retained mutation and caching', () => {
  it('returns stats and updates node layout when retained properties change', () => {
    const first = box({ width: 10, height: 10 })
    const second = box({ width: 10, height: 10 })
    const row = hstack({ spacing: 5 }, first, second)
    const engine = createLayoutEngine({ root: row })

    const firstStats = engine.layout({})
    expect(firstStats.nodes).toBe(3)
    expect(rect(row)?.width).toBe(25)

    row.spacing = 20
    const secondStats = engine.layout({})
    expect(secondStats.nodes).toBe(3)
    expect(rect(row)?.width).toBe(40)
  })

  it('does not remeasure when only alignment changes', () => {
    const child = box({ width: 10, height: 10 })
    const row = hstack({ spacing: 5, alignment: 'top' }, child, spacer())
    const engine = createLayoutEngine({ root: row })

    engine.layout({ height: 30 })
    row.alignment = 'bottom'
    const stats = engine.layout({ height: 30 })

    expect(stats.measureCalls).toBe(0)
    expect(rect(child)).toEqual({ x: 0, y: 20, width: 10, height: 10 })
  })

  it('invalidates leaf and ancestors from measure keys and explicit invalidation', () => {
    let measured = 0
    const child = leaf({
      measure: () => {
        measured += 1
        return { width: measured, height: 10 }
      },
    })
    const root = hstack(child)
    const engine = createLayoutEngine({ root })

    engine.layout({})
    expect(rect(root)?.width).toBe(1)
    expect(engine.layout({}).measureCalls).toBe(0)

    child.measureKey = 'next'
    engine.layout({})
    expect(rect(root)?.width).toBe(2)

    child.invalidateMeasure()
    engine.layout({})
    expect(rect(root)?.width).toBe(3)
  })

  it('uses DOM-like reparenting semantics', () => {
    const child = box({ width: 10, height: 10 })
    const first = hstack(child)
    const second = vstack()

    second.append(child)

    expect(first.children).toHaveLength(0)
    expect(second.children).toEqual([child])
    expect(child.parent).toBe(second)
  })

  it('supports append, prepend, insertBefore, replaceChildren, remove, and dispose', () => {
    const first = box({ width: 1, height: 1 })
    const second = box({ width: 1, height: 1 })
    const third = box({ width: 1, height: 1 })
    const root = hstack()

    root.append(second)
    root.prepend(first)
    root.insertBefore(third, second)
    expect(root.children).toEqual([first, third, second])

    third.remove()
    expect(root.children).toEqual([first, second])
    expect(third.parent).toBe(null)

    root.replaceChildren(third)
    expect(first.parent).toBe(null)
    expect(second.parent).toBe(null)
    expect(root.children).toEqual([third])

    root.dispose()
    expect(root.parent).toBe(null)
    expect(third.parent).toBe(null)
  })

  it('cleans up subscriptions when leaves are removed, replaced, or disposed', () => {
    const cleanup = vi.fn()
    const child = leaf({
      measure: () => ({ width: 1, height: 1 }),
      subscribe: () => cleanup,
    })
    const root = hstack(child)
    const engine = createLayoutEngine({ root })

    engine.layout({})
    child.remove()
    expect(cleanup).toHaveBeenCalledTimes(1)

    const cleanupTwo = vi.fn()
    const next = leaf({
      measure: () => ({ width: 1, height: 1 }),
      subscribe: () => cleanupTwo,
    })
    root.append(next)
    engine.layout({})
    root.replaceChildren()
    expect(cleanupTwo).toHaveBeenCalledTimes(1)

    const cleanupThree = vi.fn()
    const disposed = leaf({
      measure: () => ({ width: 1, height: 1 }),
      subscribe: () => cleanupThree,
    })
    root.append(disposed)
    engine.layout({})
    disposed.dispose()
    expect(cleanupThree).toHaveBeenCalledTimes(1)
  })

  it('reports subscription invalidations', () => {
    let notify: ((cause?: unknown) => void) | undefined
    let measured = 0
    const onInvalidate = vi.fn()
    const child = leaf({
      measure: () => {
        measured += 1
        return { width: measured, height: 10 }
      },
      subscribe: (next) => {
        notify = next
      },
    })
    const root = hstack(child)
    const engine = createLayoutEngine({ root, onInvalidate })

    engine.layout({})
    expect(rect(root)?.width).toBe(1)

    notify?.('resize')
    const stats = engine.layout({})

    expect(rect(root)?.width).toBe(2)
    expect(stats.invalidations).toBe(1)
    expect(onInvalidate).toHaveBeenCalledWith({ id: child.id, node: child, cause: 'resize' })
  })

  it('resubscribes when the subscribe function changes', () => {
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const firstSubscribe = vi.fn(() => firstCleanup)
    const secondSubscribe = vi.fn(() => secondCleanup)
    const child = leaf({
      measure: () => ({ width: 1, height: 1 }),
      subscribe: firstSubscribe,
    })
    const engine = createLayoutEngine({ root: child })

    engine.layout({})
    expect(firstSubscribe).toHaveBeenCalledTimes(1)

    child.subscribe = secondSubscribe

    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondSubscribe).toHaveBeenCalledTimes(1)

    engine.dispose()
    expect(secondCleanup).toHaveBeenCalledTimes(1)
  })

  it('caps measurement cache growth for highly variable layouts', () => {
    const engine = createLayoutEngine({ root: box({ width: 10, height: 10 }), maxCachedMeasurements: 4 })

    for (let width = 1; width <= 10; width += 1) {
      engine.layout({ width })
    }

    expect(engine.layout({ width: 11 }).cacheMisses).toBeGreaterThan(0)
  })

  it('can disable measurement caching', () => {
    const engine = createLayoutEngine({
      root: hstack(box({ width: 10, height: 10 }), box({ width: 10, height: 10 })),
      maxCachedMeasurements: 0,
    })

    const first = engine.layout({ width: 100 })
    const second = engine.layout({ width: 100 })

    expect(first.cacheHits).toBe(0)
    expect(second.cacheHits).toBe(0)
    expect(second.measureCalls).toBe(first.measureCalls)
  })
})
